(function() {
    // 创建涟漪容器（如果不存在）
    let container = document.querySelector('.ripple-container');
    console.assert("running...");
    if (!container) {
        container = document.createElement('div');
        container.className = 'ripple-container';
        document.body.appendChild(container);
    }

    // 随机颜色生成器（可选）
    function getRandomColor() {
        const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 点击事件处理
    document.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';

        // 获取点击坐标
        const x = e.clientX;
        const y = e.clientY;

        // 随机大小（30~80px）
        const size = 30 + Math.random() * 50;
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';

        // 随机颜色（可选）
        ripple.style.background = getRandomColor();
        // 或者使用固定半透明白色： ripple.style.background = 'rgba(255,255,255,0.4)';

        container.appendChild(ripple);

        // 动画结束后移除元素
        ripple.addEventListener('animationend', function() {
            ripple.remove();
        });
    });
})();