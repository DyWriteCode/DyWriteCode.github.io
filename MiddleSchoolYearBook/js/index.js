var mySwiper = new Swiper ('.swiper-container', {
    direction: 'vertical',
    mousewheel: true,
    loop: false,
    grabCursor: true,

    on:{
        init: function(){
            swiperAnimateCache(this); // Hide animated elements
            swiperAnimate(this); // Initialization completes the start animation
        },
        slideChangeTransitionEnd: function(){
            swiperAnimate(this); // The current slide animation is also run at the end of each slide toggle
        }
    },
});

// Music Icon Effect
var music = document.getElementById("music");
var musicIg = document.querySelectorAll(".musicIg")[0];
var musicImg = document.querySelectorAll(".musicImg")[0];
var audio;
var flag = 1;
var userInteracted = false;
music.onclick = function () {
    if (flag == 1) {
        musicImg.style.display = "none";
        musicIg.style.animation = "none";
        audio.pause();
        flag = 0;
    }
    else {
        musicImg.style.display = "block";
        musicIg.style.animation = " turn 6s infinite linear";
        audio.play();
        flag = 1;
    }
}; 

// Windows Setting
window.onload = function setupInteractionDetection() {
    // 监听所有交互事件
    const events = ['click', 'keydown', 'touchstart', 'scroll'];
    events.forEach(eventType => {
        document.addEventListener(eventType, (e) => {
            // 标记用户已交互
            if (!userInteracted) {
                userInteracted = true;
                audio = document.querySelector("audio");
                audio.play();
            }
        });
    });
}