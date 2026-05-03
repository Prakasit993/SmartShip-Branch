/** โครงร่างระหว่างนำทางมายังหน้า login — โหลดเร็ว ไม่ต้องรอ Turnstile */
export default function AdminLoginLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-900">
            <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-500"
                role="status"
                aria-label="กำลังโหลด"
            />
        </div>
    );
}
