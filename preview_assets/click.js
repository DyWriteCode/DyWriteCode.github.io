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
        const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9ff3', '#00d2ff'];
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