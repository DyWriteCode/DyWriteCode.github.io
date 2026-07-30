const CORRECT_CODE = '2026';
let targetHref = '';

document.getElementById('customLink').addEventListener('click', function (e) {
    e.preventDefault();
    targetHref = this.href; // 暂存目标地址
    document.getElementById('myModal').style.display = 'flex'; // 显示弹窗
    document.getElementById('codeInput').value = ''; // 清空输入
    document.getElementById('codeInput').focus();
});

function verifyAccess() {
    const input = document.getElementById('codeInput').value;
    if (input === CORRECT_CODE) {
        window.location.href = targetHref; // 验证通过，跳转
    } else {
        alert('数字错误，请重试！');
        document.getElementById('codeInput').value = '';
        document.getElementById('codeInput').focus();
    }
}

// 按回车键触发确认
document.getElementById('codeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') verifyAccess();
});