// 数据
const yearData = {
    '2025': {
        title: '2025',
        description: '这是我们一起走过的2025，有欢笑、有成长，感谢你的陪伴。',
        images: ['assets/moon.webp', 'assets/moon.webp'], 
        messages: ['2025年，认识你真好！', '愿你永远快乐～']
    },
    '2026': {
        title: '2026',
        description: '2026年，新的开始，愿我们继续同行，创造更多美好回忆。',
        images: ['assets/sun.webp', 'assets/sun.webp'],
        messages: ['2026，未来可期！', '加油！']
    }
};

let currentYear = null;
let currentImageIndex = 0;

// DOM 元素
const modal = document.getElementById('detailModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const carouselImg = document.getElementById('carouselImg');
const messageList = document.getElementById('messageList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMessageBtn');
const closeBtn = document.querySelector('.close-btn');
const prevBtn = document.getElementById('carouselPrev');
const nextBtn = document.getElementById('carouselNext');

// 打开模态框
function openModal(year) {
    currentYear = year;
    const data = yearData[year];
    if (!data) return;

    modalTitle.textContent = data.title;
    modalDesc.textContent = data.description;
    currentImageIndex = 0;
    updateImage();
    renderMessages(data.messages);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
}

// 关闭模态框
function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// 更新图片
function updateImage() {
    const data = yearData[currentYear];
    if (data && data.images.length > 0) {
        carouselImg.src = data.images[currentImageIndex % data.images.length];
    }
}

// 渲染留言
function renderMessages(messages) {
    messageList.innerHTML = '';
    messages.forEach(msg => {
        const li = document.createElement('li');
        li.textContent = msg;
        messageList.appendChild(li);
    });
    // 滚动到最新留言
    messageList.scrollTop = messageList.scrollHeight;
}

// 添加留言
function addMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentYear) return;
    yearData[currentYear].messages.push(text);
    renderMessages(yearData[currentYear].messages);
    messageInput.value = '';
}

// 卡片点击事件
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', function(e) {
        e.preventDefault(); // 阻止跳转
        const href = this.getAttribute('href');
        const year = href.split('/')[0]; // 提取 "2025" 或 "2026"
        if (year === '2025' || year === '2026') {
            openModal(year);
        }
    });
});

// 事件绑定
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
});
prevBtn.addEventListener('click', function() {
    const data = yearData[currentYear];
    if (data) {
        currentImageIndex = (currentImageIndex - 1 + data.images.length) % data.images.length;
        updateImage();
    }
});
nextBtn.addEventListener('click', function() {
    const data = yearData[currentYear];
    if (data) {
        currentImageIndex = (currentImageIndex + 1) % data.images.length;
        updateImage();
    }
});
sendBtn.addEventListener('click', addMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addMessage();
});

// 键盘 Esc 关闭
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});