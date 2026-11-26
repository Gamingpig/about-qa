package de.gamingpig.widget

import android.app.job.JobParameters
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import java.util.concurrent.Executors

/**
 * Reliable JobScheduler sync fallback that wakes when network connectivity is available,
 * complementing AlarmManager polling when Doze/Standby defers inexact alarms.
 */
class WidgetSyncJobService : JobService() {

    private val jobExecutor = Executors.newSingleThreadExecutor()

    override fun onStartJob(params: JobParameters?): Boolean {
        val appContext = applicationContext
        val manager = AppWidgetManager.getInstance(appContext)
        val ids = manager.getAppWidgetIds(ComponentName(appContext, GamingpigWidgetProvider::class.java))
        if (ids.isEmpty()) {
            return false
        }

        jobExecutor.execute {
            try {
                val snapshot = TrackDataFetcher.fetchCurrentTrack()
                GamingpigWidgetProvider.lastSnapshot = snapshot
                for (id in ids) {
                    GamingpigWidgetProvider.updateAppWidget(appContext, manager, id, snapshot, isSyncing = false)
                }
                GamingpigWidgetProvider.scheduleAdaptiveAlarms(appContext, snapshot)
                UpdateChecker.recordSyncAndMaybeCheckUpdate(appContext)
            } finally {
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters?): Boolean {
        return true
    }
}
