package de.gamingpig.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class GamingpigWidgetProvider : AppWidgetProvider() {

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        scheduleNextNetworkPoll(context, MAX_POLL_INTERVAL_MS)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelAllAlarms(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateAppWidget(context, appWidgetManager, appWidgetId, lastSnapshot, isSyncing = false)
        if (lastSnapshot == null) {
            refreshAllWidgets(context)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val pendingResult = goAsync()
        executor.execute {
            try {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                lastSnapshot = snapshot
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId, snapshot, isSyncing = false)
                }
                scheduleAdaptiveAlarms(context, snapshot)
                UpdateChecker.recordSyncAndMaybeCheckUpdate(context)
            } finally {
                pendingResult.finish()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action ?: return

        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))

        // Seamless in-place upgrade of existing homescreen widgets after APK update
        if (action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            if (ids.isNotEmpty()) {
                performNetworkRefresh(context, manager, ids, showSyncFeedback = false)
            }
            return
        }

        if (ids.isEmpty()) {
            cancelAllAlarms(context)
            return
        }

        // Local 5s timeline tick (0 network calls!)
        if (action == ACTION_TICK_TIMELINE) {
            if (!isScreenOn(context)) {
                scheduleNextNetworkPoll(context, MAX_POLL_INTERVAL_MS)
                return
            }

            val snap = lastSnapshot
            if (snap != null && snap.isPlaying) {
                for (id in ids) {
                    updateAppWidget(context, manager, id, snap, isSyncing = false)
                }
                val rem = snap.remainingMs()
                val sinceLastFetch = System.currentTimeMillis() - snap.fetchedAtMs
                if (rem <= 12_000L && sinceLastFetch >= END_OF_SONG_POLL_MS) {
                    performNetworkRefresh(context, manager, ids, showSyncFeedback = false)
                } else {
                    scheduleNextTimelineTick(context, TIMELINE_TICK_MS)
                }
            }
            return
        }

        if (action == ACTION_REFRESH || action == ACTION_AUTO_POLL) {
            if (action == ACTION_AUTO_POLL && !isScreenOn(context)) {
                scheduleNextNetworkPoll(context, MAX_POLL_INTERVAL_MS)
                return
            }

            performNetworkRefresh(
                context,
                manager,
                ids,
                showSyncFeedback = (action == ACTION_REFRESH)
            )
        }
    }

    private fun performNetworkRefresh(
        context: Context,
        manager: AppWidgetManager,
        ids: IntArray,
        showSyncFeedback: Boolean
    ) {
        if (showSyncFeedback) {
            for (id in ids) {
                updateAppWidget(context, manager, id, lastSnapshot, isSyncing = true)
            }
        }

        val pendingResult = goAsync()
        executor.execute {
            try {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                lastSnapshot = snapshot
                for (id in ids) {
                    updateAppWidget(context, manager, id, snapshot, isSyncing = false)
                }
                scheduleAdaptiveAlarms(context, snapshot)
                UpdateChecker.recordSyncAndMaybeCheckUpdate(context)
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "de.gamingpig.widget.ACTION_REFRESH"
        const val ACTION_AUTO_POLL = "de.gamingpig.widget.ACTION_AUTO_POLL"
        const val ACTION_TICK_TIMELINE = "de.gamingpig.widget.ACTION_TICK_TIMELINE"

        const val PREFS_NAME = "gp_widget_prefs"
        const val KEY_THEME = "widget_theme"
        const val KEY_SHOW_PROGRESS = "show_progress"
        const val KEY_SHOW_TIMELINE = "show_timeline"
        const val KEY_SHOW_RECENT = "show_recent"
        const val KEY_TAP_OPENS_SPOTIFY = "tap_opens_spotify"
        const val KEY_TEXT_SIZE = "text_size" // "small", "normal", "large"

        private const val MAX_POLL_INTERVAL_MS = 30_000L
        private const val END_OF_SONG_POLL_MS = 5_000L
        private const val TIMELINE_TICK_MS = 5_000L

        private val executor = Executors.newSingleThreadExecutor()

        @Volatile
        var lastSnapshot: TrackSnapshot? = null

        private fun isScreenOn(context: Context): Boolean {
            return try {
                val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                pm?.isInteractive ?: true
            } catch (_: Exception) {
                true
            }
        }

        private fun getPendingIntent(context: Context, action: String, reqCode: Int): PendingIntent {
            val intent = Intent(context, GamingpigWidgetProvider::class.java).apply {
                this.action = action
            }
            return PendingIntent.getBroadcast(
                context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        fun scheduleAdaptiveAlarms(context: Context, snapshot: TrackSnapshot?) {
            val delayMs = if (snapshot != null && snapshot.isPlaying) {
                val rem = snapshot.remainingMs()
                when {
                    rem <= 15_000L -> END_OF_SONG_POLL_MS
                    rem < MAX_POLL_INTERVAL_MS -> (rem + 1000L).coerceIn(END_OF_SONG_POLL_MS, MAX_POLL_INTERVAL_MS)
                    else -> MAX_POLL_INTERVAL_MS
                }
            } else {
                MAX_POLL_INTERVAL_MS
            }

            scheduleNextNetworkPoll(context, delayMs)

            if (snapshot != null && snapshot.isPlaying && isScreenOn(context)) {
                scheduleNextTimelineTick(context, TIMELINE_TICK_MS)
            } else {
                cancelTimelineTick(context)
            }
        }

        fun scheduleNextNetworkPoll(context: Context, delayMs: Long) {
            try {
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
                if (ids.isEmpty()) return

                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + delayMs.coerceIn(3_000L, MAX_POLL_INTERVAL_MS),
                    getPendingIntent(context, ACTION_AUTO_POLL, 201)
                )
            } catch (_: Exception) {
            }
        }

        fun scheduleNextTimelineTick(context: Context, delayMs: Long) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + delayMs,
                    getPendingIntent(context, ACTION_TICK_TIMELINE, 202)
                )
            } catch (_: Exception) {
            }
        }

        fun cancelTimelineTick(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarmManager.cancel(getPendingIntent(context, ACTION_TICK_TIMELINE, 202))
            } catch (_: Exception) {
            }
        }

        fun cancelAllAlarms(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarmManager.cancel(getPendingIntent(context, ACTION_AUTO_POLL, 201))
                alarmManager.cancel(getPendingIntent(context, ACTION_TICK_TIMELINE, 202))
            } catch (_: Exception) {
            }
        }

        fun refreshAllWidgets(context: Context, showSyncFeedback: Boolean = false) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GamingpigWidgetProvider::class.java))
            if (ids.isEmpty()) return

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
                scheduleAdaptiveAlarms(context, snapshot)
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

        private fun createSolidRoundedBitmap(color: Int): Bitmap {
            val w = 240
            val h = 160
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.color = color
            canvas.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), 26f, 26f, paint)

            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 2f
            paint.color = Color.argb(65, 255, 255, 255)
            canvas.drawRoundRect(RectF(1f, 1f, w - 1f, h - 1f), 26f, 26f, paint)
            return bmp
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
            val showTimeline = prefs.getBoolean(KEY_SHOW_TIMELINE, true)
            val showRecent = prefs.getBoolean(KEY_SHOW_RECENT, false)
            val tapOpensSpotify = prefs.getBoolean(KEY_TAP_OPENS_SPOTIFY, false)
            val textSizePref = prefs.getString(KEY_TEXT_SIZE, "normal") ?: "normal"

            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val layoutId = selectLayoutForSize(options)
            val isCompact = (layoutId == R.layout.widget_layout_compact)
            val isLarge = (layoutId == R.layout.widget_layout_large)
            val isLight = (effectiveTheme == "light")

            val views = RemoteViews(context.packageName, layoutId)

            // Apply Background (Static Ambient Blur, Ambient Color, or Vector Drawable)
            when {
                effectiveTheme == "ambient_blur" && snapshot?.blurredBgBitmap != null -> {
                    views.setInt(R.id.widget_root, "setBackgroundResource", 0)
                    views.setViewVisibility(R.id.widget_bg_image, View.VISIBLE)
                    views.setImageViewBitmap(R.id.widget_bg_image, snapshot.blurredBgBitmap)
                }
                effectiveTheme == "ambient_color" && snapshot != null -> {
                    views.setInt(R.id.widget_root, "setBackgroundResource", 0)
                    views.setViewVisibility(R.id.widget_bg_image, View.VISIBLE)
                    views.setImageViewBitmap(R.id.widget_bg_image, createSolidRoundedBitmap(snapshot.dominantColor))
                }
                else -> {
                    views.setViewVisibility(R.id.widget_bg_image, View.GONE)
                    val bgRes = when (effectiveTheme) {
                        "light" -> R.drawable.widget_bg_light
                        "oled" -> R.drawable.widget_bg_oled
                        "cyber" -> R.drawable.widget_bg_cyber
                        else -> R.drawable.widget_bg_liquid
                    }
                    views.setInt(R.id.widget_root, "setBackgroundResource", bgRes)
                }
            }

            // Text Sizes (Small / Normal / Large)
            val sizeDelta = when (textSizePref) {
                "small" -> -2f
                "large" -> 2.5f
                else -> 0f
            }
            val baseTitleSp = when {
                isCompact -> 13f
                isLarge -> 17f
                else -> 15f
            }
            val baseArtistSp = when {
                isCompact -> 11f
                isLarge -> 13f
                else -> 12f
            }
            val baseMetaSp = if (isLarge) 11f else 10f

            views.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, baseTitleSp + sizeDelta)
            views.setTextViewTextSize(R.id.widget_artist, TypedValue.COMPLEX_UNIT_SP, baseArtistSp + sizeDelta)
            views.setTextViewTextSize(R.id.widget_meta, TypedValue.COMPLEX_UNIT_SP, baseMetaSp + (sizeDelta * 0.5f))
            views.setTextViewTextSize(R.id.widget_recent_text, TypedValue.COMPLEX_UNIT_SP, baseMetaSp + (sizeDelta * 0.5f))

            // Colors
            val btnBgRes = if (isLight) R.drawable.widget_btn_bg_light else R.drawable.widget_btn_bg_dark
            views.setInt(R.id.widget_btn_refresh, "setBackgroundResource", btnBgRes)
            views.setInt(R.id.widget_btn_config, "setBackgroundResource", btnBgRes)

            val iconTextColor = Color.parseColor(if (isLight) "#0F172A" else "#E2E8F0")
            views.setTextColor(R.id.widget_btn_refresh, iconTextColor)
            views.setTextColor(R.id.widget_btn_config, iconTextColor)

            val titleColor = Color.parseColor(if (isLight) "#0F172A" else "#FFFFFF")
            val artistColor = Color.parseColor(if (isLight) "#475569" else "#CBD5E1")
            val metaColor = Color.parseColor(if (isLight) "#0284C7" else "#38BDF8")
            val recentColor = Color.parseColor(if (isLight) "#64748B" else "#94A3B8")
            views.setTextColor(R.id.widget_title, titleColor)
            views.setTextColor(R.id.widget_artist, artistColor)
            views.setTextColor(R.id.widget_meta, metaColor)
            views.setTextColor(R.id.widget_recent_text, recentColor)

            val nowMs = System.currentTimeMillis()
            val timeLabel = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(nowMs))

            if (isSyncing) {
                views.setTextViewText(R.id.widget_btn_refresh, "⏳")
                views.setTextViewText(R.id.widget_status_text, if (isCompact) "SYNC..." else "SYNCHRONISIERE...")
                views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#0284C7" else "#38BDF8"))
            } else {
                views.setTextViewText(R.id.widget_btn_refresh, "↻")
            }

            if (snapshot != null) {
                val curMs = snapshot.currentProgressMs(nowMs)
                val curPct = snapshot.currentProgressPct(nowMs)
                val timelineText = if (showTimeline && snapshot.durationMs > 0L) {
                    "${TrackDataFetcher.formatTime(curMs)} / ${TrackDataFetcher.formatTime(snapshot.durationMs)} · "
                } else ""

                views.setTextViewText(R.id.widget_title, snapshot.title)
                views.setTextViewText(R.id.widget_artist, snapshot.artist)

                if (!isSyncing) {
                    if (snapshot.isPlaying) {
                        views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_live)
                        views.setTextViewText(
                            R.id.widget_status_text,
                            if (isCompact && showTimeline) "GAMINGPIG · ${TrackDataFetcher.formatTime(curMs)}"
                            else if (isCompact) "GAMINGPIG · LIVE"
                            else "GAMINGPIG IS LISTENING TO"
                        )
                        views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#0284C7" else "#38BDF8"))
                        views.setTextViewText(R.id.widget_meta, "🎵 ${timelineText}Spotify")
                    } else {
                        views.setImageViewResource(R.id.widget_status_dot, R.drawable.status_dot_idle)
                        views.setTextViewText(
                            R.id.widget_status_text,
                            if (isCompact) "OFFLINE" else "GAMINGPIG IS OFFLINE"
                        )
                        views.setTextColor(R.id.widget_status_text, Color.parseColor(if (isLight) "#64748B" else "#94A3B8"))
                        views.setTextViewText(R.id.widget_meta, "🌙 Offline · $timeLabel")
                    }
                }

                if (snapshot.artBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_cover, snapshot.artBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_cover, R.drawable.ic_launcher_pig)
                }

                views.setProgressBar(R.id.widget_progress, 100, curPct, false)

                // Recently Played line (in Standard & Large widgets when enabled)
                if (showRecent && !isCompact && snapshot.recentTracks.isNotEmpty()) {
                    val recLine = if (isLarge && snapshot.recentTracks.size >= 2) {
                        "🕒 Zuletzt: ${snapshot.recentTracks[0].title} · ${snapshot.recentTracks[0].artist}\n" +
                        "🕒 Davor: ${snapshot.recentTracks[1].title} · ${snapshot.recentTracks[1].artist}"
                    } else {
                        "🕒 Zuletzt: ${snapshot.recentTracks[0].title} · ${snapshot.recentTracks[0].artist}"
                    }
                    views.setTextViewText(R.id.widget_recent_text, recLine)
                    views.setViewVisibility(R.id.widget_recent_text, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_recent_text, View.GONE)
                }
            }

            val minH = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) ?: 110
            val hideProgressForTiny = minH < 72
            views.setViewVisibility(
                R.id.widget_progress,
                if (showProgress && !hideProgressForTiny) View.VISIBLE else View.GONE
            )

            // Click on App Logo -> always open Gamingpig Portfolio Website
            val logoIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/"))
            val logoPending = PendingIntent.getActivity(
                context, 100, logoIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_app_logo, logoPending)

            // Click on content -> open Spotify song (if enabled) or Portfolio Website
            val targetUrl = if (tapOpensSpotify && !snapshot?.spotifyUrl.isNullOrBlank()) {
                snapshot!!.spotifyUrl!!
            } else {
                "https://gamingpig.github.io/about-qa/"
            }
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl))
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
