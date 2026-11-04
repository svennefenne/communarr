package io.github.svennefenne.communarr

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * The Communarr app: the server's own site in a web view, as it looks in a browser. Logged out (the
 * first time, after logging out, or when the session has run out) it shows only its own log-in screen:
 * the server's address, a username and a password. Logged in, it shows the server's notifications
 * (Push), and installs a newer copy of itself from the server when the page's menu offers one.
 */
class MainActivity : ComponentActivity() {
    private lateinit var root: FrameLayout
    private var web: WebView? = null
    private var server = ""
    // (the page reads the app's name and version here: "Get the app" hidden, "New version" offered)
    private val userAgent by lazy { "${WebSettings.getDefaultUserAgent(this)} CommunarrApp/${BuildConfig.VERSION_NAME} (${getString(R.string.app_name)})" }

    // a picture to post: the phone's own picker
    private var picked: ValueCallback<Array<Uri>>? = null
    private val pickOne = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        picked?.onReceiveValue(uri?.let { arrayOf(it) })
        picked = null
    }
    private val pickMany = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        picked?.onReceiveValue(uris.toTypedArray())
        picked = null
    }

    // the microphone, for a voice room: Android asks the first time
    private var asking: PermissionRequest? = null
    private val askMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        asking?.let { if (ok) it.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else it.deny() }
        asking = null
    }

    // notifications (Android 13 and later ask); the page's "Turn on" waits for the answer
    private var notifyReply: JavaScriptReplyProxy? = null
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        Push.asked(this)
        val reply = notifyReply
        notifyReply = null
        val to = server
        thread {
            val st = if (Push.permission(this) == "granted") Push.register(this, to) else Push.status(this, this)
            runOnUiThread { reply?.postMessage(st.copy(permission = Push.permission(this, this)).json()) }
        }
    }

    // an update downloaded while Android still had to allow installing from this app
    private var waiting: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // a debug build's page can be inspected from a computer (chrome://inspect)
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
        root = FrameLayout(this).apply { setBackgroundColor(BG) }
        setContentView(root)
        bars(BG)
        // the page stays clear of the status and navigation bars (and the keyboard)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        onBackPressedDispatcher.addCallback(this) {
            val w = web
            if (w != null && w.canGoBack()) w.goBack() else moveTaskToBack(true)
        }
        // logged in before: the site (it sends a run-out session to /login, which brings the log-in screen back)
        val saved = Server.saved(this)
        if (saved == null) showLogIn(null) else showWeb(saved, intent.getStringExtra(OPEN))
    }

    /** A notification tapped while the app was open: its page. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val path = intent.getStringExtra(OPEN)?.takeIf(::sitePath) ?: return
        val w = web
        if (w != null) w.loadUrl(server + path) else if (server.isNotEmpty()) showWeb(server, path)
    }

    // in the background the page is hidden: the server counts this phone as away, and pushes to it
    override fun onStart() {
        super.onStart()
        web?.onResume()
    }

    override fun onStop() {
        web?.onPause()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        themeBars()
        // back from allowing installs from this app: the update it downloaded
        waiting?.let { if (packageManager.canRequestPackageInstalls()) install(it) }
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        web?.destroy()
        super.onDestroy()
    }

    // ------------------------------------------------------------ logging in

    /** The log-in screen, all there is when logged out: the server's address, a username and a password. */
    private fun showLogIn(problem: String?) {
        clear()
        bars(BG)
        val box = column()
        box.addView(ImageView(this).apply { setImageResource(R.drawable.logo) },
            LinearLayout.LayoutParams(dp(72), dp(72)).apply { bottomMargin = dp(18) })
        box.addView(TextView(this).apply {
            text = getString(R.string.intro)
            setTextColor(TEXT)
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(22))
        })
        val address = field(box, R.string.server, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI, EditorInfo.IME_ACTION_NEXT).apply {
            setText(server.ifEmpty { Server.saved(this@MainActivity) ?: "" }.removePrefix("https://"))
            hint = getString(R.string.server_hint)
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
        }
        val username = field(box, R.string.username, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS, EditorInfo.IME_ACTION_NEXT).apply {
            setText(Server.username(this@MainActivity))
            setAutofillHints(View.AUTOFILL_HINT_USERNAME)
        }
        val password = field(box, R.string.password, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD, EditorInfo.IME_ACTION_GO).apply {
            setAutofillHints(View.AUTOFILL_HINT_PASSWORD)
        }
        val note = TextView(this).apply {
            text = problem ?: ""
            setTextColor(ERROR)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(12))
        }
        box.addView(note, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        val go = Button(this).apply {
            text = getString(R.string.log_in).uppercase()
            setTextColor(ON_ACCENT)
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.06f
            background = rounded(ACCENT)
            stateListAnimator = null
        }
        box.addView(go, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)))

        var busy = false
        val submit = submit@{
            if (busy) return@submit                // the keyboard's Go and Enter can both fire
            val user = username.text.toString().trim()
            val pass = password.text.toString()
            val to = Server.normalize(address.text.toString())
            note.setTextColor(ERROR)
            when {
                address.text.isBlank() || user.isEmpty() || pass.isEmpty() -> note.text = getString(R.string.fill_in)
                to == null -> note.text = getString(R.string.bad_address)
                else -> {
                    busy = true
                    go.isEnabled = false
                    go.alpha = 0.6f
                    note.setTextColor(MUTED)
                    note.text = getString(R.string.logging_in)
                    hideKeyboard(password)
                    thread {
                        val r = Server.logIn(this, to, user, pass, userAgent)
                        runOnUiThread {
                            busy = false
                            go.isEnabled = true
                            go.alpha = 1f
                            when (r) {
                                is Server.Result.In -> {
                                    val jar = CookieManager.getInstance()
                                    r.cookies.forEach { jar.setCookie(r.address, it) }
                                    jar.flush()
                                    Server.save(this, r.address, user)
                                    showWeb(r.address)
                                }
                                is Server.Result.Out -> {
                                    note.setTextColor(ERROR)
                                    note.text = r.message
                                }
                            }
                        }
                    }
                }
            }
        }
        go.setOnClickListener { submit() }
        password.setOnEditorActionListener { _, action, event ->
            val enter = event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN
            if (action == EditorInfo.IME_ACTION_GO || enter) submit()
            true
        }

        // narrow and in the middle; scrolls when the keyboard leaves too little room
        val scroll = ScrollView(this).apply { isFillViewport = true }
        val middle = FrameLayout(this)
        middle.addView(box, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        scroll.addView(middle, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
        root.addView(scroll, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        // (who's been here before writes only the password)
        (if (address.text.isNotEmpty() && username.text.isNotEmpty()) password else if (address.text.isNotEmpty()) username else address).requestFocus()
    }

    /** A labelled field, in the site's look. */
    private fun field(box: LinearLayout, label: Int, type: Int, action: Int): EditText {
        box.addView(TextView(this).apply {
            text = getString(label).uppercase()
            setTextColor(MUTED)
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.14f
            setPadding(dp(2), dp(10), 0, dp(6))
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        val f = EditText(this).apply {
            // (one line first: set after the type, it would undo a password's dots)
            isSingleLine = true
            inputType = type
            imeOptions = action
            textSize = 17f
            setTextColor(TEXT)
            setHintTextColor(FAINT)
            highlightColor = ColorUtils.setAlphaComponent(ACCENT_2, 0x55)
            background = StateListDrawable().apply {
                addState(intArrayOf(android.R.attr.state_focused), rounded(FIELD, ACCENT_2))
                addState(intArrayOf(), rounded(FIELD, LINE))
            }
            setPadding(dp(14), dp(12), dp(14), dp(12))
            contentDescription = getString(label)
        }
        // (a password field keeps a hint's typeface monospace otherwise)
        if (type and InputType.TYPE_TEXT_VARIATION_PASSWORD != 0) f.typeface = Typeface.DEFAULT
        box.addView(f, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        return f
    }

    /** The server can't be reached (or broke): try again, or log in somewhere else. Logged in, trying again needs no password. */
    private fun showProblem(message: String) {
        clear()
        bars(BG)
        val box = column()
        box.addView(ImageView(this).apply { setImageResource(R.drawable.logo) },
            LinearLayout.LayoutParams(dp(72), dp(72)).apply { bottomMargin = dp(18) })
        box.addView(TextView(this).apply {
            text = message
            setTextColor(TEXT)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(20))
        })
        val again = Button(this).apply {
            text = getString(R.string.try_again).uppercase()
            setTextColor(ON_ACCENT)
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.06f
            background = rounded(ACCENT)
            stateListAnimator = null
            setOnClickListener { showWeb(server) }
        }
        box.addView(again, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)))
        box.addView(Button(this).apply {
            text = getString(R.string.other_server)
            setTextColor(MUTED)
            isAllCaps = false
            background = null
            stateListAnimator = null
            setOnClickListener { showLogIn(null) }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(6) })
        root.addView(box, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    }

    // ------------------------------------------------------------ the site

    @SuppressLint("SetJavaScriptEnabled")
    private fun showWeb(address: String, path: String? = null) {
        server = address
        var registered = false
        clear()
        val w = WebView(this)
        w.setBackgroundColor(BG)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // others' voices in a voice room play without a tap first
            mediaPlaybackRequiresUserGesture = false
            // (the site hides its "Get the app" in here)
            userAgentString = userAgent
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(w, false)
        }
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false        // a video embedded in a post, say
                val url = request.url
                if (url.scheme in setOf("http", "https") && Server.origin(url) == server) {
                    if (!loggedOut(url)) return false
                    root.post { showLogIn(null) }
                    return true
                }
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }   // other sites open in the browser
                return true
            }

            // the site's log-in page (after logging out, or a session that ran out): the app's own instead
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (view == web && loggedOut(Uri.parse(url))) {
                    view.stopLoading()
                    root.post { showLogIn(null) }
                }
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                if (view != web) return
                if (loggedOut(Uri.parse(url))) root.post { showLogIn(null) } else themeBars()
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (view != web) return
                themeBars()
                // logged in: notifications (once a start)
                if (!registered && !loggedOut(Uri.parse(url))) {
                    registered = true
                    notifications()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (view == web && request.isForMainFrame) root.post { showProblem(getString(R.string.unreachable, server, error.description)) }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (view == web && request.isForMainFrame && response.statusCode >= 500) {
                    root.post { showProblem(getString(R.string.server_error, server, response.statusCode)) }
                }
            }

            /** Android ended the page to free memory: load it again. */
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                if (view == web) root.post { showWeb(server) }
                return true
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                picked?.onReceiveValue(null)
                picked = callback
                val type = params.acceptTypes.firstOrNull { it.contains("/") } ?: "*/*"
                if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) pickMany.launch(type) else pickOne.launch(type)
                return true
            }

            /** The microphone for a voice room, for the server's own pages only (the camera isn't used). */
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val mine = Server.origin(request.origin) == server
                    if (!mine || PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources) {
                        request.deny()
                    } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        asking?.deny()
                        asking = request
                        askMic.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }
        }
        // the page's messages to the app (window.CommunarrApp), from the server's own pages only
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(w, "CommunarrApp", setOf(address)) { _, message, _, isMainFrame, reply ->
                if (isMainFrame) message.data?.let { fromPage(it, reply) }
            }
        }
        // a download that isn't a page: the browser's
        w.setDownloadListener { url, _, _, _, _ -> runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
        root.addView(w, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        web = w
        w.loadUrl(if (path != null && sitePath(path)) address + path else address)
    }

    /** A path on the site ("/lists/3"), not somewhere else ("//elsewhere.example"). */
    private fun sitePath(path: String) = path.startsWith("/") && !path.startsWith("//") && !path.contains('\\')

    // ------------------------------------------------------------ the page's messages

    private fun fromPage(data: String, reply: JavaScriptReplyProxy) {
        val m = runCatching { JSONObject(data) }.getOrNull() ?: return
        when (m.optString("t")) {
            "update" -> update(m.optString("url"))
            "push-status" -> {
                val to = server
                thread {
                    // (signs the phone up first if it isn't yet)
                    val st = if (Push.status(this).ready) Push.status(this) else Push.register(this, to)
                    runOnUiThread { reply.postMessage(st.copy(permission = Push.permission(this, this)).json()) }
                }
            }
            "push-on" -> askForNotifications(reply)
            "push-settings" -> runCatching {
                startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
            }
        }
    }

    // ------------------------------------------------------------ notifications

    /** Logged in: sign this phone up with the server, and the first time ask Android to allow notifications. */
    private fun notifications() {
        val to = server
        thread {
            val st = Push.register(this, to)
            runOnUiThread { if (st.configured && Push.permission(this, this) == "ask" && !getSharedPreferences("push", MODE_PRIVATE).getBoolean("asked", false)) askForNotifications(null) }
        }
    }

    private fun askForNotifications(reply: JavaScriptReplyProxy?) {
        if (Build.VERSION.SDK_INT >= 33 && Push.permission(this, this) == "ask") {
            notifyReply = reply
            askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            val to = server
            thread {
                val st = Push.register(this, to)
                runOnUiThread { reply?.postMessage(st.copy(permission = Push.permission(this, this)).json()) }
            }
        }
    }

    // ------------------------------------------------------------ updating itself

    /** A newer copy of the app on the server ("Update" in the page's menu): downloaded, then Android's installer. */
    private fun update(url: String) {
        val uri = runCatching { Uri.parse(URL(URL(server), url).toString()) }.getOrNull() ?: return
        if (Server.origin(uri) != server || uri.path?.matches(Regex("/[A-Za-z0-9][\\w.-]*\\.apk")) != true) return
        Toast.makeText(this, R.string.downloading, Toast.LENGTH_SHORT).show()
        thread {
            val file = File(cacheDir, "updates/update.apk")
            val failed = try {
                file.parentFile?.mkdirs()
                val conn = URL(uri.toString()).openConnection() as HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout = 60_000
                try {
                    if (conn.responseCode != 200) "HTTP ${conn.responseCode}" else {
                        conn.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
                        null
                    }
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                e.message ?: e.javaClass.simpleName
            }
            runOnUiThread {
                if (failed == null) install(file) else Toast.makeText(this, getString(R.string.download_failed, failed), Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun install(file: File) {
        // the first time, Android asks to allow installing from this app (then onResume goes on)
        if (!packageManager.canRequestPackageInstalls()) {
            waiting = file
            runCatching { startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }
            return
        }
        waiting = null
        val apk = FileProvider.getUriForFile(this, "$packageName.files", file)
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(apk, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    /** The site's log-in page: where it sends someone who isn't logged in. */
    private fun loggedOut(url: Uri) = url.scheme in setOf("http", "https") && Server.origin(url) == server && url.path == "/login"

    /** The status and navigation bars in the page's own colour (its theme's), with icons that show on it. */
    private fun themeBars() {
        web?.evaluateJavascript(THEME_COLOR) { v ->
            runCatching { Color.parseColor(JSONArray("[$v]").getString(0)) }.getOrNull()?.let(::bars)
        }
    }

    private fun bars(color: Int) {
        root.setBackgroundColor(color)
        val light = ColorUtils.calculateLuminance(color) > 0.5
        val style = if (light) SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT) else SystemBarStyle.dark(Color.TRANSPARENT)
        enableEdgeToEdge(style, style)
    }

    /** Whatever is on screen, gone (the web view destroyed, not just hidden). */
    private fun clear() {
        web?.let {
            root.removeView(it)
            it.destroy()
        }
        web = null
        root.removeAllViews()
    }

    /** A screen's column: as wide as the window has room for, at most 380dp (on a tablet), in the middle. */
    private fun column(): LinearLayout {
        val max = dp(380)
        return object : LinearLayout(this) {
            override fun onMeasure(widthSpec: Int, heightSpec: Int) {
                val w = MeasureSpec.getSize(widthSpec)
                super.onMeasure(if (w > max) MeasureSpec.makeMeasureSpec(max, MeasureSpec.EXACTLY) else widthSpec, heightSpec)
            }
        }.apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            val pad = dp(24)
            setPadding(pad, pad, pad, pad)
        }
    }

    private fun hideKeyboard(view: View) {
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(view.windowToken, 0)
        view.clearFocus()
    }

    private fun rounded(fill: Int, stroke: Int? = null) = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        color = ColorStateList.valueOf(fill)
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        /** A notification's page to open (its path on the site). */
        const val OPEN = "open"

        // the site's own dark colours (src/app/styles/base.css)
        private val BG = Color.parseColor("#070b10")
        private val FIELD = Color.parseColor("#0c1218")
        private val TEXT = Color.parseColor("#efe3c8")
        private val MUTED = Color.parseColor("#8f9aa1")
        private val FAINT = Color.parseColor("#66707a")
        private val LINE = Color.argb(46, 239, 227, 200)
        private val ACCENT = Color.parseColor("#d65a2b")
        private val ON_ACCENT = Color.parseColor("#fff6e6")
        private val ACCENT_2 = Color.parseColor("#e2a634")
        private val ERROR = Color.parseColor("#ef6b5a")

        /** The page's theme colour: its theme-color for the phone's light or dark mode. */
        private const val THEME_COLOR = """(() => { const m = [...document.querySelectorAll('meta[name="theme-color"]')].find((x) => !x.media || matchMedia(x.media).matches); return m ? m.content : null; })()"""
    }
}
