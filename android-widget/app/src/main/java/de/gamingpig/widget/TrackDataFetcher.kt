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
    val progressPct: Int
)

object TrackDataFetcher {
    private const val NPC_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now"
    private const val STATSFM_URL = "https://api.stats.fm/api/v1/users/gamingpig/streams/current"

    fun fetchCurrentTrack(): TrackSnapshot {
        var isPlaying = false
        var title = "Aktuell ist es ruhig..."
        var artist = "Gamingpig StandBy"
        var artUrl: String? = null
        var progressPct = 0

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

                    val dur = trk.optLong("durationMs", 0L)
                    val stream = item.optJSONObject("stream")
                    val prog = if (item.has("progressMs")) {
                        item.optLong("progressMs", 0L)
                    } else {
                        stream?.optLong("progressMs", 0L) ?: 0L
                    }
                    if (dur > 0) {
                        progressPct = ((prog.toDouble() / dur.toDouble()) * 100.0).toInt().coerceIn(0, 100)
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
                    val dur = track.optLong("duration_ms", 0L)
                    val prog = npcJson?.optLong("progress_ms", 0L) ?: 0L
                    if (dur > 0) {
                        progressPct = ((prog.toDouble() / dur.toDouble()) * 100.0).toInt().coerceIn(0, 100)
                    } else if (progressPct == 0) {
                        progressPct = 35
                    }
                }
            } catch (_: Exception) {
            }
        }

        val bitmap = if (!artUrl.isNullOrBlank()) fetchRoundedBitmap(artUrl) else null
        return TrackSnapshot(isPlaying, title, artist, artUrl, bitmap, progressPct)
    }

    private fun fetchJson(urlStr: String): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "GamingpigWidget/1.1 (Android)")
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
                setRequestProperty("User-Agent", "GamingpigWidget/1.1 (Android)")
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
