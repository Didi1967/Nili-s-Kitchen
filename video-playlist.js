(function () {
  "use strict";

  var playlist = [
    "WhatsApp Video 2026-07-24 at 19.21.52.mp4",
    "WhatsApp Video 2026-07-24 at 19.21.53.mp4",
    "WhatsApp Video 2026-07-24 at 19.22.08.mp4",
    "WhatsApp Video 2026-07-24 at 19.22.08 (1).mp4",
    "WhatsApp Video 2026-07-24 at 19.22.08 (2).mp4",
    "WhatsApp Video 2026-07-24 at 19.22.09.mp4"
  ];

  function startPlaylist(video) {
    var currentIndex = 0;
    var failedVideos = 0;

    function playCurrent() {
      video.src = "./Videolar/" + encodeURIComponent(playlist[currentIndex]);
      video.load();

      var playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(function () {
          // Mobile browsers may wait for the first user interaction.
        });
      }
    }

    function playNext() {
      currentIndex = (currentIndex + 1) % playlist.length;
      playCurrent();
    }

    video.addEventListener("ended", function () {
      failedVideos = 0;
      playNext();
    });

    video.addEventListener("error", function () {
      failedVideos += 1;
      if (failedVideos < playlist.length) {
        playNext();
      }
    });

    playCurrent();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("video.nili-video-playlist").forEach(startPlaylist);
  });
})();
