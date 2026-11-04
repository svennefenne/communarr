package io.github.svennefenne.communarr

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Notifications, through Firebase Cloud Messaging. The server has the Firebase project's settings
 * (Admin → Notifications & voice) and hands this app its own after logging in; the app starts
 * Firebase with them, sends the server this phone's token (kept for as long as the log-in lasts),
 * and shows what's pushed. Tapping one opens its page in the app.
 */
object Push {
    private const val PREFS = "push"
    const val CHANNEL = "notifications"

    /** What the page's Settings → Notifications shows. */
    data class Status(val permission: String, val configured: Boolean, val ready: Boolean) {
        fun json(): String = JSONObject().put("t", "push-status").put("permission", permission).put("configured", configured).put("ready", ready).toString()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** At the app's start: the channel, and Firebase with the settings the server gave last time. */
    fun start(context: Context) {
        channel(context)
        saved(context)?.let { runCatching { firebase(context, it) } }
    }

    private fun saved(context: Context): FirebaseOptions? {
        val p = prefs(context)
        val o = listOf("apiKey", "appId", "projectId", "senderId").map { p.getString(it, null) ?: return null }
        return FirebaseOptions.Builder().setApiKey(o[0]).setApplicationId(o[1]).setProjectId(o[2]).setGcmSenderId(o[3]).build()
    }

    /** Firebase started with these settings (started again if it had another project's). */
    private fun firebase(context: Context, o: FirebaseOptions) {
        val cur = FirebaseApp.getApps(context).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
        if (cur != null) {
            if (cur.options.applicationId == o.applicationId && cur.options.projectId == o.projectId) return
            cur.delete()
            // (another project: another token)
            prefs(context).edit().remove("token").apply()
        }
        FirebaseApp.initializeApp(context, o)
    }

    /** This phone's token, as Firebase gave it (PushService.onRegistered). */
    fun keepToken(context: Context, token: String) = prefs(context).edit().putString("token", token).apply()

    /**
     * Logged in to `server`: its Firebase settings for this app, and this phone's token to it. Runs
     * on a background thread; returns where that leaves notifications.
     */
    fun register(context: Context, server: String): Status {
        val got = runCatching { request(context, server, "GET", "/api/app/push?app=${context.packageName}", null) }.getOrNull()
        val o = got?.optJSONObject("options")
        if (got != null && o == null) {
            prefs(context).edit().putBoolean("configured", false).putBoolean("ready", false).apply()
            return Status(permission(context), configured = false, ready = false)
        }
        if (o == null) return status(context)         // (the server didn't answer: as it was)
        prefs(context).edit()
            .putString("apiKey", o.optString("apiKey")).putString("appId", o.optString("appId"))
            .putString("projectId", o.optString("projectId")).putString("senderId", o.optString("senderId"))
            .putBoolean("configured", true).apply()
        val ok = runCatching {
            firebase(context, saved(context)!!)
            // the token: the one Firebase gave before, else sign up and wait for it (PushService.onRegistered)
            val token = prefs(context).getString("token", null) ?: run {
                Tasks.await(FirebaseMessaging.getInstance().register(), 30, TimeUnit.SECONDS)
                val until = System.currentTimeMillis() + 30_000
                var t: String? = null
                while (t == null && System.currentTimeMillis() < until) {
                    t = prefs(context).getString("token", null)
                    if (t == null) Thread.sleep(250)
                }
                t
            }
            token != null && sendToken(context, server, token)
        }.getOrDefault(false)
        prefs(context).edit().putBoolean("ready", ok).apply()
        return Status(permission(context), configured = true, ready = ok)
    }

    /** This phone's token to the server, for the log-in the app has with it. */
    fun sendToken(context: Context, server: String, token: String): Boolean = runCatching {
        request(context, server, "POST", "/api/app/push", JSONObject().put("token", token).put("app", context.packageName))?.optBoolean("ok") == true
    }.getOrDefault(false)

    private fun request(context: Context, server: String, method: String, path: String, body: JSONObject?): JSONObject? {
        val conn = URL("$server$path").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("Cookie", CookieManager.getInstance().getCookie(server) ?: "")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "CommunarrApp/${BuildConfig.VERSION_NAME} (${context.getString(R.string.app_name)})")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            if (conn.responseCode != 200) return null
            return JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    /** Where notifications stand on this phone: Android's permission, and what the server said last. */
    fun status(context: Context, activity: Activity? = null): Status {
        val p = prefs(context)
        return Status(permission(context, activity), p.getBoolean("configured", false), p.getBoolean("ready", false))
    }

    /** "granted", "ask" (Android can still ask), or "denied" (only the app's settings can allow them now). */
    fun permission(context: Context, activity: Activity? = null): String {
        if (NotificationManagerCompat.from(context).areNotificationsEnabled()) return "granted"
        if (Build.VERSION.SDK_INT >= 33) {
            val asked = prefs(context).getBoolean("asked", false)
            if (!asked || activity?.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) == true) return "ask"
        }
        return "denied"
    }

    fun asked(context: Context) = prefs(context).edit().putBoolean("asked", true).apply()

    private fun channel(context: Context) {
        val c = NotificationChannel(CHANNEL, context.getString(R.string.notifications), NotificationManager.IMPORTANCE_HIGH)
        c.description = context.getString(R.string.notifications_about)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(c)
    }

    /** A push as a notification; one with the same tag (a chat room, a list) takes the last one's place. */
    fun show(context: Context, data: Map<String, String>) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val url = data["url"].orEmpty()
        val tag = data["tag"].orEmpty().ifEmpty { url }
        val open = Intent(context, MainActivity::class.java).putExtra(MainActivity.OPEN, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(context, tag.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val body = data["body"].orEmpty()
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(Color.parseColor("#d65a2b"))
            .setContentTitle(data["title"])
            .setContentText(body.ifEmpty { null })
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .apply { data["badge"]?.toIntOrNull()?.let { setNumber(it) } }
            .build()
        try {
            NotificationManagerCompat.from(context).notify(tag, 1, n)
        } catch (_: SecurityException) {
            // (notifications not allowed after all)
        }
    }
}
