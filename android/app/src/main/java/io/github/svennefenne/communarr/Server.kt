package io.github.svennefenne.communarr

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** The Communarr server the app shows (its address: scheme, host and port, no path) and who logged in last, kept between runs. */
object Server {
    private const val PREFS = "communarr"

    fun saved(context: Context): String? = prefs(context).getString("server", null)

    fun username(context: Context): String = prefs(context).getString("username", null) ?: ""

    fun save(context: Context, address: String, username: String) {
        prefs(context).edit().putString("server", address).putString("username", username).apply()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** "example.com" → "https://example.com"; anything after the address is dropped. */
    fun normalize(input: String): String? {
        val text = input.trim().trimEnd('/')
        if (text.isEmpty()) return null
        val uri = Uri.parse(if ("://" in text) text else "https://$text")
        if (uri.scheme !in setOf("http", "https") || uri.host.isNullOrEmpty()) return null
        return origin(uri)
    }

    fun origin(uri: Uri): String {
        val port = if (uri.port != -1) ":${uri.port}" else ""
        return "${uri.scheme}://${uri.host}$port"
    }

    /** What came of logging in. */
    sealed interface Result {
        /** In: the server's address (an http one moved to https is the https one) and its cookies, for the web view. */
        data class In(val address: String, val cookies: List<String>) : Result
        /** Not in: what to tell them (the server's own words, in the site's language, when it said why). */
        data class Out(val message: String) : Result
    }

    /**
     * Logs in with the server's own log-in for the app (POST /api/app/login, the same checks as its
     * log-in page). Runs on a background thread.
     */
    fun logIn(context: Context, address: String, username: String, password: String, userAgent: String, moved: Boolean = false): Result {
        val conn = try {
            URL("$address/api/app/login").openConnection() as HttpURLConnection
        } catch (e: Exception) {
            return Result.Out(context.getString(R.string.unreachable, address, e.message ?: e.javaClass.simpleName))
        }
        return try {
            conn.requestMethod = "POST"
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", userAgent)
            conn.outputStream.use { it.write(JSONObject().put("username", username).put("password", password).toString().toByteArray()) }
            val code = conn.responseCode
            // http://… sent on to https://… on the same host: log in there instead
            val location = conn.getHeaderField("Location")
            if (code in 300..399 && location != null && !moved) {
                val to = Uri.parse(URL(URL(address), location).toString())
                if (to.host == Uri.parse(address).host) return logIn(context, origin(to), username, password, userAgent, true)
            }
            val text = (if (code >= 400) conn.errorStream else conn.inputStream)?.bufferedReader()?.use { it.readText() } ?: ""
            val json = runCatching { JSONObject(text) }.getOrNull()
            when {
                json == null || !json.has("ok") ->
                    Result.Out(if (code >= 500) context.getString(R.string.server_error, address, code) else context.getString(R.string.not_communarr))
                json.optBoolean("ok") -> {
                    val cookies = conn.headerFields.filterKeys { it != null && it.equals("Set-Cookie", ignoreCase = true) }.values.flatten()
                    Result.In(address, cookies)
                }
                else -> Result.Out(json.optString("error").ifEmpty { context.getString(R.string.server_error, address, code) })
            }
        } catch (e: Exception) {
            Result.Out(context.getString(R.string.unreachable, address, e.message ?: e.javaClass.simpleName))
        } finally {
            conn.disconnect()
        }
    }
}
