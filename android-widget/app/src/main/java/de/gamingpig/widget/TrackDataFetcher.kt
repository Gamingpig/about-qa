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

        try {
            val statsJson = fetchJson("$STATSFM_URL?t=${System.currentTimeMillis()}")
            val item = statsJson?.optJSONObject("item")
            val stream = statsJson?.optJSONObject("stream")
            if (item != null) {
                isPlaying = true
                title = item.optString("name", title)
                val artists = item.optJSONArray("artists")
                if (artists != null && artists.length() > 0) {
                    artist = artists.getJSONObject(0).optString("name", artist)
                }
                val albums = item.optJSONArray("albums")
                if (albums != null && albums.length() > 0) {
                    artUrl = albums.getJSONObject(0).optString("image", null)
                }
                val dur = item.optLong("durationMs", 0L)
                val prog = stream?.optLong("progressMs", 0L) ?: 0L
                if (dur > 0) {
                    progressPct = ((prog.toDouble() / dur.toDouble()) * 100.0).toInt().coerceIn(0, 100)
                }
            }
        } catch (_: Exception) {
        }

        if (!isPlaying) {
            try {
                val npcJson = fetchJson("$NPC_URL?t=${System.currentTimeMillis()}")
                val track = npcJson?.optJSONObject("track")
                if (track != null) {
                    isPlaying = npcJson.optBoolean("isPlaying", false)
                    title = track.optString("title", title)
                    artist = track.optString("artist", artist)
                    if (artUrl.isNullOrBlank()) {
                        artUrl = track.optString("art", null)
                    }
                    if (isPlaying && progressPct == 0) progressPct = 35
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
                connectTimeout = 4000
                readTimeout = 4000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
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
                connectTimeout = 4000
                readTimeout = 4000
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
