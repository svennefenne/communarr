package io.github.svennefenne.communarr

import android.app.Application

/** The app's process: Firebase is started with the server's settings from last time, so a push that starts the app finds it ready. */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Push.start(this)
    }
}
