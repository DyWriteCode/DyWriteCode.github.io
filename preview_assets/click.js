document.addEventListener('DOMContentLoaded', function() {
    // 创建涟漪容器（如果不存在）
    let container = document.querySelector('.ripple-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'ripple-container';
        document.body.appendChild(container);
    }

    // 随机颜色生成
    function getRandomColor() {
        const colors = ['radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(0, 200, 255, 0.4) 60%, rgba(0, 100, 200, 0) 100%)',
        'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(64, 224, 208, 0.4) 50%, rgba(0, 128, 128, 0) 100%)',
        'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(135, 206, 250, 0.4) 50%, rgba(70, 130, 180, 0) 100%)',
        'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(0, 191, 255, 0.5) 60%, rgba(0, 0, 139, 0) 100%)',];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 点击涟漪效果
    document.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';

        const x = e.clientX;
        const y = e.clientY;
        const size = 30 + Math.random() * 50; // 30~80px
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';
        ripple.style.background = getRandomColor();

        container.appendChild(ripple);

        // 动画结束后移除元素
        ripple.addEventListener('animationend', function() {
            ripple.remove();
        });
    });
});