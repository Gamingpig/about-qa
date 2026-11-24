package de.gamingpig.widget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class RemoteUpdateInfo(
    val versionCode: Long,
    val versionName: String,
    val apkUrl: String,
    val notes: String,
    val isUpdateAvailable: Boolean
)

object UpdateChecker {
    private const val VERSION_JSON_URL = "https://gamingpig.github.io/about-qa/downloads/widget_version.json"
    private const val PREFS_NAME = "gp_widget_update_prefs"
    private const val KEY_SYNC_COUNT = "sync_counter"
    private const val KEY_LAST_NOTIFIED_CODE = "last_notified_version_code"
    private const val CHANNEL_ID = "gp_widget_updates"
    private const val NOTIFICATION_ID = 4001
    private const val SYNC_CHECK_INTERVAL = 100

    fun getCurrentVersionCode(context: Context): Long {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
        } catch (_: Exception) {
            1L
        }
    }

    fun getCurrentVersionName(context: Context): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "2.0.0"
        } catch (_: Exception) {
            "2.0.0"
        }
    }

    /**
     * Increments the sync counter and checks for an APK update every 100 syncs.
     * Should be called from a background thread during widget sync.
     */
    fun recordSyncAndMaybeCheckUpdate(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val count = prefs.getInt(KEY_SYNC_COUNT, 0) + 1
        prefs.edit().putInt(KEY_SYNC_COUNT, if (count >= SYNC_CHECK_INTERVAL) 0 else count).apply()

        if (count >= SYNC_CHECK_INTERVAL) {
            val info = fetchUpdateInfo(context)
            if (info != null && info.isUpdateAvailable) {
                val lastNotified = prefs.getLong(KEY_LAST_NOTIFIED_CODE, 0L)
                if (info.versionCode > lastNotified) {
                    prefs.edit().putLong(KEY_LAST_NOTIFIED_CODE, info.versionCode).apply()
                    showUpdateNotification(context, info)
                }
            }
        }
    }

    fun fetchUpdateInfo(context: Context): RemoteUpdateInfo? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("$VERSION_JSON_URL?t=${System.currentTimeMillis()}").openConnection() as HttpURLConnection).apply {
                connectTimeout = 4500
                readTimeout = 4500
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "GamingpigWidget-Updater/2.0")
            }
            if (conn.responseCode == 200) {
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(text)
                val remoteCode = json.optLong("versionCode", 0L)
                val remoteName = json.optString("versionName", "Update")
                val apkUrl = json.optString("apkUrl", "https://gamingpig.github.io/about-qa/downloads/GamingpigWidget.apk")
                val notes = json.optString("notes", "Neue Features und Verbesserungen verfügbar.")
                val localCode = getCurrentVersionCode(context)
                RemoteUpdateInfo(
                    versionCode = remoteCode,
                    versionName = remoteName,
                    apkUrl = apkUrl,
                    notes = notes,
                    isUpdateAvailable = remoteCode > localCode
                )
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun showUpdateNotification(context: Context, info: RemoteUpdateInfo) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    return
                }
            }

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Widget App Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Benachrichtigt, wenn eine neue Version der Gamingpig Widget App verfügbar ist."
            }
            nm.createNotificationChannel(channel)

            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(
                context, 4002, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = android.app.Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_pig)
                .setContentTitle("🚀 Gamingpig Widget v${info.versionName} verfügbar!")
                .setContentText("Tippe hier, um das Update zu laden. Bestehende Widgets bleiben erhalten.")
                .setAutoCancel(true)
                .setContentIntent(pending)

            nm.notify(NOTIFICATION_ID, builder.build())
        } catch (_: Exception) {
        }
    }
}
