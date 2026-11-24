package de.gamingpig.widget

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class TrackSnapshot(
    val isPlaying: Boolean,
    val title: String,
    val artist: String,
    val artUrl: String?,
    val artBitmap: Bitmap?,
    val progressMs: Long,
    val durationMs: Long,
    val fetchedAtMs: Long = System.currentTimeMillis()
) {
    fun currentProgressMs(nowMs: Long = System.currentTimeMillis()): Long {
        if (!isPlaying || durationMs <= 0L) return progressMs.coerceAtLeast(0L)
        val elapsed = (nowMs - fetchedAtMs).coerceAtLeast(0L)
        return (progressMs + elapsed).coerceIn(0L, durationMs)
    }

    fun currentProgressPct(nowMs: Long = System.currentTimeMillis()): Int {
        if (!isPlaying || durationMs <= 0L) return 0
        return ((currentProgressMs(nowMs).toDouble() / durationMs.toDouble()) * 100.0).toInt().coerceIn(0, 100)
    }

    fun remainingMs(nowMs: Long = System.currentTimeMillis()): Long {
        if (!isPlaying || durationMs <= 0L) return Long.MAX_VALUE
        return (durationMs - currentProgressMs(nowMs)).coerceAtLeast(0L)
    }
}

object TrackDataFetcher {
    private const val NPC_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now"
    private const val STATSFM_URL = "https://api.stats.fm/api/v1/users/gamingpig/streams/current"

    @Volatile
    private var cachedArtUrl: String? = null

    @Volatile
    private var cachedArtBitmap: Bitmap? = null

    fun formatTime(ms: Long): String {
        if (ms <= 0L) return "0:00"
        val totalSec = ms / 1000L
        val min = totalSec / 60L
        val sec = totalSec % 60L
        return "$min:${if (sec < 10) "0$sec" else "$sec"}"
    }

    fun fetchCurrentTrack(): TrackSnapshot {
        var isPlaying = false
        var title = "Aktuell ist es ruhig..."
        var artist = "Gamingpig StandBy"
        var artUrl: String? = null
        var progressMs = 0L
        var durationMs = 0L

        // 1. Primary: stats.fm Live Current Stream
        try {
            val statsJson = fetchJson("$STATSFM_URL?t=${System.currentTimeMillis()}")
            val item = statsJson?.optJSONObject("item")
            if (item != null) {
                val trk = item.optJSONObject("track") ?: item
                val playingFlag = item.optBoolean("isPlaying", true)
                if (playingFlag) {
                    isPlaying = true
                    title = trk.optString("name", "").ifBlank { title }

                    val artistsArr = trk.optJSONArray("artists")
                    if (artistsArr != null && artistsArr.length() > 0) {
                        val names = mutableListOf<String>()
                        for (i in 0 until artistsArr.length()) {
                            val n = artistsArr.optJSONObject(i)?.optString("name", "")
                            if (!n.isNullOrBlank()) names.add(n)
                        }
                        if (names.isNotEmpty()) artist = names.joinToString(", ")
                    }

                    val albumsArr = trk.optJSONArray("albums")
                    if (albumsArr != null && albumsArr.length() > 0) {
                        artUrl = albumsArr.optJSONObject(0)?.optString("image", null)
                    }

                    durationMs = trk.optLong("durationMs", 0L)
                    val stream = item.optJSONObject("stream")
                    progressMs = if (item.has("progressMs")) {
                        item.optLong("progressMs", 0L)
                    } else {
                        stream?.optLong("progressMs", 0L) ?: 0L
                    }
                }
            }
        } catch (_: Exception) {
        }

        // 2. Fallback: NPC API
        if (!isPlaying) {
            try {
                val npcJson = fetchJson("$NPC_URL?t=${System.currentTimeMillis()}")
                val statusStr = npcJson?.optString("status", "") ?: ""
                val track = npcJson?.optJSONObject("track")
                if (track != null && (statusStr == "playing" || npcJson?.optBoolean("isPlaying", false) == true)) {
                    isPlaying = true
                    title = track.optString("title", "").ifBlank { title }
                    artist = track.optString("artist", "").ifBlank { artist }
                    if (artUrl.isNullOrBlank()) {
                        artUrl = track.optString("artwork_url", "").ifBlank { track.optString("art", null) }
                    }
                    durationMs = track.optLong("duration_ms", 0L)
                    progressMs = npcJson?.optLong("progress_ms", 0L) ?: 0L
                }
            } catch (_: Exception) {
            }
        }

        val bitmap = if (!artUrl.isNullOrBlank()) {
            if (artUrl == cachedArtUrl && cachedArtBitmap != null) {
                cachedArtBitmap
            } else {
                val downloaded = fetchRoundedBitmap(artUrl)
                if (downloaded != null) {
                    cachedArtUrl = artUrl
                    cachedArtBitmap = downloaded
                }
                downloaded
            }
        } else {
            null
        }

        return TrackSnapshot(
            isPlaying = isPlaying,
            title = title,
            artist = artist,
            artUrl = artUrl,
            artBitmap = bitmap,
            progressMs = progressMs,
            durationMs = durationMs,
            fetchedAtMs = System.currentTimeMillis()
        )
    }

    private fun fetchJson(urlStr: String): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "GamingpigWidget/1.3 (Android)")
            }
            if (conn.responseCode == 200) {
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                if (text.isNotBlank()) JSONObject(text) else null
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun fetchRoundedBitmap(urlStr: String): Bitmap? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("User-Agent", "GamingpigWidget/1.3 (Android)")
            }
            if (conn.responseCode == 200) {
                val raw = conn.inputStream.use { BitmapFactory.decodeStream(it) } ?: return null
                val scaled = Bitmap.createScaledBitmap(raw, 160, 160, true)
                getRoundedCornerBitmap(scaled, 26f)
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun getRoundedCornerBitmap(bitmap: Bitmap, pixels: Float): Bitmap {
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint().apply {
            isAntiAlias = true
            color = -0xbdbdbe
        }
        val rect = Rect(0, 0, bitmap.width, bitmap.height)
        val rectF = RectF(rect)
        canvas.drawARGB(0, 0, 0, 0)
        canvas.drawRoundRect(rectF, pixels, pixels, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)
        return output
    }
}
