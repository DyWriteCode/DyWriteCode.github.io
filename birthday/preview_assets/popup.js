let targetHref = '';
let correctPwd = '';

// 绑定所有带密码的链接（核心复用逻辑）
document.querySelectorAll('a[data-password]').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        targetHref = this.href;
        correctPwd = this.dataset.password; // 获取当前链接专属密码

        document.getElementById('myModal').style.display = 'flex';
        document.getElementById('codeInput').value = '';
        document.getElementById('codeInput').focus();
    });
});

function verifyAccess() {
    const input = document.getElementById('codeInput').value;
    if (input === correctPwd) {
        window.location.href = targetHref;
    } else {
        alert('密码错误，请重试！');
        document.getElementById('codeInput').value = '';
        document.getElementById('codeInput').focus();
    }
}

// 回车触发验证
document.getElementById('codeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') verifyAccess();
});

// 点击弹窗外部关闭（可选）
document.getElementById('myModal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
});