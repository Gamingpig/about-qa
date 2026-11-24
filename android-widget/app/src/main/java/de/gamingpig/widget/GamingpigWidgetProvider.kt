package de.gamingpig.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
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

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        // Immediately re-layout with cached snapshot so resizing feels instant
        updateAppWidget(context, appWidgetManager, appWidgetId, lastSnapshot, isSyncing = false)
        if (lastSnapshot == null) {
            refreshAllWidgets(context)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        scheduleNextRefresh(context)
        val pendingResult = goAsync()
        executor.execute {
            try {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                lastSnapshot = snapshot
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId, snapshot, isSyncing = false)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_REFRESH || action == ACTION_AUTO_POLL) {
            scheduleNextRefresh(context)
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))

            // Instant visual feedback when user taps Refresh!
            if (action == ACTION_REFRESH && ids.isNotEmpty()) {
                for (id in ids) {
                    updateAppWidget(context, manager, id, lastSnapshot, isSyncing = true)
                }
            }

            val pendingResult = goAsync()
            executor.execute {
                try {
                    if (ids.isNotEmpty()) {
                        val snapshot = TrackDataFetcher.fetchCurrentTrack()
                        lastSnapshot = snapshot
                        for (id in ids) {
                            updateAppWidget(context, manager, id, snapshot, isSyncing = false)
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

        @Volatile
        var lastSnapshot: TrackSnapshot? = null

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

        fun refreshAllWidgets(context: Context, showSyncFeedback: Boolean = false) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
            if (ids.isEmpty()) return
            scheduleNextRefresh(context)

            if (showSyncFeedback) {
                for (id in ids) {
                    updateAppWidget(context, manager, id, lastSnapshot, isSyncing = true)
                }
            }

            executor.execute {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                lastSnapshot = snapshot
                for (id in ids) {
                    updateAppWidget(context, manager, id, snapshot, isSyncing = false)
                }
            }
        }

        fun resolveEffectiveTheme(context: Context, savedTheme: String): String {
            if (savedTheme != "auto") return savedTheme
            val nightModeFlags = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
            return if (nightModeFlags == Configuration.UI_MODE_NIGHT_YES) "liquid" else "light"
        }

        private fun selectLayoutForSize(options: Bundle?): Int {
            val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) ?: 110
            val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) ?: 250
            return when {
                minHeight < 95 || minWidth < 180 -> R.layout.widget_layout_compact
                minHeight >= 165 -> R.layout.widget_layout_large
                else -> R.layout.widget_layout
            }
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            snapshot: TrackSnapshot?,
            isSyncing: Boolean = false
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedTheme = prefs.getString(KEY_THEME, "auto") ?: "auto"
            val effectiveTheme = resolveEffectiveTheme(context, savedTheme)
            val showProgress = prefs.getBoolean(KEY_SHOW_PROGRESS, true)

            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val layoutId = selectLayoutForSize(options)
            val isCompact = (layoutId == R.layout.widget_layout_compact)
            val isLight = (effectiveTheme == "light")

            val views = RemoteViews(context.packageName, layoutId)

            // Apply Background & Colors based on Theme
            val bgRes = when (effectiveTheme) {
                "light" -> R.drawable.widget_bg_light
                "oled" -> R.drawable.widget_bg_oled
                "cyber" -> R.drawable.widget_bg_cyber
                else -> R.drawable.widget_bg_liquid
            }
            views.setInt(R.id.widget_root, "setBackgroundResource", bgRes)

            val btnBgRes = if (isLight) R.drawable.widget_btn_bg_light else R.drawable.widget_btn_bg_dark
            views.setInt(R.id.widget_btn_refresh, "setBackgroundResource", btnBgRes)
            views.setInt(R.id.widget_btn_config, "setBackgroundResource", btnBgRes)

            val iconTextColor = Color.parseColor(if (isLight) "#0F172A" else "#E2E8F0")
            views.setTextColor(R.id.widget_btn_refresh, iconTextColor)
            views.setTextColor(R.id.widget_btn_config, iconTextColor)

            val titleColor = Color.parseColor(if (isLight) "#0F172A" else "#FFFFFF")
            val artistColor = Color.parseColor(if (isLight) "#475569" else "#94A3B8")
            val metaColor = Color.parseColor(if (isLight) "#0284C7" else "#38BDF8")
            views.setTextColor(R.id.widget_title, titleColor)
            views.setTextColor(R.id.widget_artist, artistColor)
            views.setTextColor(R.id.widget_meta, metaColor)

            val timeLabel = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

            if (isSyncing) {
                views.setTextViewText(R.id.widget_btn_refresh, "⏳")
                views.setTextViewText(R.id.widget_status_text, if (isCompact) "SYNC..." else "SYNCHRONISIERE...")
                views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#0284C7" else "#38BDF8"))
            } else {
                views.setTextViewText(R.id.widget_btn_refresh, "↻")
            }

            if (snapshot != null) {
                views.setTextViewText(R.id.widget_title, snapshot.title)
                views.setTextViewText(R.id.widget_artist, snapshot.artist)

                if (!isSyncing) {
                    if (snapshot.isPlaying) {
                        views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_live)
                        views.setTextViewText(R.id.widget_status_text, if (isCompact) "LIVE" else "NOW PLAYING")
                        views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#059669" else "#34D399"))
                        views.setTextViewText(R.id.widget_meta, "🎵 Live auf Spotify · ${snapshot.progressPct}% · $timeLabel")
                    } else {
                        views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_idle)
                        views.setTextViewText(R.id.widget_status_text, "STANDBY")
                        views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#64748B" else "#94A3B8"))
                        views.setTextViewText(R.id.widget_meta, "🌙 Offline · $timeLabel")
                    }
                }

                if (snapshot.artBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_cover, snapshot.artBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_cover, R.drawable.ic_launcher_pig)
                }

                views.setProgressBar(R.id.widget_progress, 100, snapshot.progressPct, false)
            }

            val minH = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) ?: 110
            val hideProgressForTiny = minH < 72
            views.setViewVisibility(
                R.id.widget_progress,
                if (showProgress && !hideProgressForTiny) View.VISIBLE else View.GONE
            )

            // Click on content -> open website in widget mode
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/?mode=widget"))
            val webPending = PendingIntent.getActivity(
                context, 101, webIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_content_area, webPending)

            // Click on Refresh -> immediately show syncing feedback and fetch latest track
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
