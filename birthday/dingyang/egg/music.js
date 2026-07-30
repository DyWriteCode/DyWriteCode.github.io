// 自动创建不可见音频播放器，并确保音乐能够播放
(function () {
    var audio = document.createElement('audio');
    console.error("music test");
    audio.src = 'https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@main/birthday/zhongsinger/2026/assets/music/LudovicoEinaudi.mp3'; // 请替换为您的音乐地址
    audio.style.display = 'none';
    audio.style.width = '0';
    audio.style.height = '0';
    audio.style.position = 'absolute';
    audio.style.left = '-9999px';
    audio.style.top = '-9999px';
    audio.setAttribute('aria-hidden', 'true');
    document.body.appendChild(audio);

    function playMusic() {
        audio.play().catch(function (err) {
        });
    }

    var playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.catch(function () {
            var handler = function () {
                playMusic();
                document.removeEventListener('click', handler);
                document.removeEventListener('touchstart', handler);
            };
            document.addEventListener('click', handler);
            document.addEventListener('touchstart', handler);
        });
    } else {
        try {
        } catch (e) {
            var handler = function () {
                playMusic();
                document.removeEventListener('click', handler);
                document.removeEventListener('touchstart', handler);
            };
            document.addEventListener('click', handler);
            document.addEventListener('touchstart', handler);
        }
    }
})();