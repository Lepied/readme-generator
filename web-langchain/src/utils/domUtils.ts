export function showAlert(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const alertDiv = document.createElement('div');
    
    // CSS 클래스 사용 (인라인 스타일 제거)
    alertDiv.className = `alert alert-${type} slide-in`;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.classList.remove('slide-in');
        alertDiv.classList.add('slide-out');
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

export function showStatus(message: string): void {
    console.log(`[STATUS] ${message}`);
    // 필요하다면 화면 하단 상태바 등에 표시하는 로직 추가 가능
}

export function updateChainProgress(step: number): void {
    // main.ts의 HTML 구조(#chainProgress li)에 맞게 선택자 수정
    const steps = document.querySelectorAll('#chainProgress li');
    
    steps.forEach((el, index) => {
        if (index < step) {
            el.classList.add('completed');
            el.classList.remove('active');
        } else if (index === step) {
            el.classList.add('active');
            el.classList.remove('completed');
        } else {
            el.classList.remove('active', 'completed');
        }
    });
}