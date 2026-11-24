package de.gamingpig.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import java.util.concurrent.Executors

class GamingpigWidgetProvider : AppWidgetProvider() {

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        scheduleNextRefresh(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelScheduledRefresh(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        scheduleNextRefresh(context)
        val pendingResult = goAsync()
        executor.execute {
            try {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId, snapshot)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH || intent.action == ACTION_AUTO_POLL) {
            scheduleNextRefresh(context)
            val pendingResult = goAsync()
            executor.execute {
                try {
                    val manager = AppWidgetManager.getInstance(context)
                    val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
                    if (ids.isNotEmpty()) {
                        val snapshot = TrackDataFetcher.fetchCurrentTrack()
                        for (id in ids) {
                            updateAppWidget(context, manager, id, snapshot)
                        }
                    } else {
                        cancelScheduledRefresh(context)
                    }
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "de.gamingpig.widget.ACTION_REFRESH"
        const val ACTION_AUTO_POLL = "de.gamingpig.widget.ACTION_AUTO_POLL"
        const val PREFS_NAME = "gp_widget_prefs"
        const val KEY_THEME = "widget_theme"
        const val KEY_SHOW_PROGRESS = "show_progress"
        private const val POLL_INTERVAL_MS = 60_000L
        private val executor = Executors.newSingleThreadExecutor()

        private fun getAutoPollPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, GamingpigWidgetProvider::class.java).apply {
                action = ACTION_AUTO_POLL
            }
            return PendingIntent.getBroadcast(
                context, 201, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        fun scheduleNextRefresh(context: Context) {
            try {
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
                if (ids.isEmpty()) return

                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                // ELAPSED_REALTIME (non-waking): saves battery when screen is off, refreshes every ~60s when active
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + POLL_INTERVAL_MS,
                    getAutoPollPendingIntent(context)
                )
            } catch (_: Exception) {
            }
        }

        fun cancelScheduledRefresh(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarmManager.cancel(getAutoPollPendingIntent(context))
            } catch (_: Exception) {
            }
        }

        fun refreshAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
            if (ids.isEmpty()) return
            scheduleNextRefresh(context)
            executor.execute {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                for (id in ids) {
                    updateAppWidget(context, manager, id, snapshot)
                }
            }
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            snapshot: TrackSnapshot?
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val theme = prefs.getString(KEY_THEME, "liquid") ?: "liquid"
            val showProgress = prefs.getBoolean(KEY_SHOW_PROGRESS, true)

            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            // Apply selected theme
            val bgRes = when (theme) {
                "oled" -> R.drawable.widget_bg_oled
                "cyber" -> R.drawable.widget_bg_cyber
                else -> R.drawable.widget_bg_liquid
            }
            views.setInt(R.id.widget_root, "setBackgroundResource", bgRes)

            if (snapshot != null) {
                views.setTextViewText(R.id.widget_title, snapshot.title)
                views.setTextViewText(R.id.widget_artist, snapshot.artist)
                if (snapshot.isPlaying) {
                    views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_live)
                    views.setTextViewText(R.id.widget_status_text, "NOW PLAYING")
                    views.setTextColor(R.id.widget_status_text, Color.parseColor("#34D399"))
                    views.setTextViewText(R.id.widget_meta, "🎵 Live auf Spotify · ${snapshot.progressPct}%")
                } else {
                    views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_idle)
                    views.setTextViewText(R.id.widget_status_text, "STANDBY")
                    views.setTextColor(R.id.widget_status_text, Color.parseColor("#94A3B8"))
                    views.setTextViewText(R.id.widget_meta, "🌙 Aktuell offline")
                }

                if (snapshot.artBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_cover, snapshot.artBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_cover, R.drawable.ic_launcher_pig)
                }

                views.setProgressBar(R.id.widget_progress, 100, snapshot.progressPct, false)
            }

            views.setViewVisibility(R.id.widget_progress, if (showProgress) View.VISIBLE else View.GONE)

            // Click on content -> open website in widget mode
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/?mode=widget"))
            val webPending = PendingIntent.getActivity(
                context, 101, webIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_content_area, webPending)

            // Click on Refresh -> immediately fetch latest track
            val refreshIntent = Intent(context, GamingpigWidgetProvider::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPending = PendingIntent.getBroadcast(
                context, 102, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPending)

            // Click on Gear -> open MainActivity to customize widget
            val configIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val configPending = PendingIntent.getActivity(
                context, 103, configIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_config, configPending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
