package io.github.svennefenne.communarr

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.concurrent.thread

/** Pushes from the server (through Firebase): each shown as a notification; this phone's token goes to the server. */
class PushService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        Push.show(this, message.data)
    }

    /** A new token for this phone (Firebase renews them now and then): to the server the app's logged in to. */
    @Suppress("OVERRIDE_DEPRECATION")
    override fun onNewToken(token: String) {
        Push.keepToken(this, token)
        val server = Server.saved(this) ?: return
        thread { Push.sendToken(this, server, token) }
    }
}
