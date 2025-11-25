// ============================================
// DOM Utility Functions
// ============================================

export function showAlert(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

export function showStatus(message: string): void {
    console.log(`[STATUS] ${message}`);
}

export function updateChainProgress(step: number): void {
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach((el, index) => {
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
