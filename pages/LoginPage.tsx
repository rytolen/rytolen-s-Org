import React, { useState } from 'react';

interface LoginPageProps {
    onLogin: (employeeId: string) => Promise<{ success: boolean, message: string }>;
}

// --- Icons ---
const IdCardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M1.5 3.75a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v16.5a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V3.75ZM9 7.5a1.5 1.5 0 0 0-1.5 1.5v5.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5H9Z" />
        <path d="M5.25 5.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75H6a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H5.25Z" />
    </svg>
);

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ModernIllustration: React.FC = () => (
    <div className="w-40 h-40 mb-8">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#0EA5E9" d="M48.1,-64.3C61.8,-53.3,72.2,-37.4,75.9,-20.2C79.6,-3,76.5,15.5,68.2,30.5C59.9,45.5,46.4,56.9,31.2,65.7C16,74.5,-0.9,80.7,-17.1,77.9C-33.3,75.1,-48.7,63.3,-61.4,48.7C-74.1,34.1,-84,17.1,-84.8,-1.1C-85.6,-19.2,-77.2,-38.4,-64,-49.5C-50.8,-60.5,-32.8,-63.3,-16.9,-65.4C-1.1,-67.5,14.5,-69.5,28.6,-71.1C42.7,-72.7,54.5,-73.9,48.1,-64.3Z" transform="translate(100 100) scale(1.1)" />
        </svg>
    </div>
);


const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [employeeId, setEmployeeId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!employeeId.trim()) {
            setError('ID Karyawan tidak boleh kosong.');
            return;
        }
        setLoading(true);
        const result = await onLogin(employeeId.trim());
        setLoading(false);
        if (!result.success) {
            setError(result.message || "Login gagal. Periksa kembali ID Anda.");
        }
    };
    
    return (
        <>
            <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4">
                <div className="w-full max-w-sm">
                    <header className="flex flex-col items-center text-center animate-fade-in-down">
                        <ModernIllustration />
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portal Karyawan</h1>
                        <p className="text-slate-500 mt-2">Masuk untuk mengelola absensi Anda.</p>
                    </header>

                    <main className="mt-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <form onSubmit={handleSubmit}>
                            <div className="relative mb-4">
                                <IdCardIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    id="employeeId"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    placeholder="ID Karyawan"
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-500 transition-all duration-200 placeholder-slate-400"
                                    disabled={loading}
                                />
                            </div>
                            
                            {error && (
                                <p className="text-red-700 text-sm mb-4 text-center bg-red-100 border border-red-200 rounded-lg py-2 px-3">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 mt-4 py-3 px-6 rounded-xl text-white bg-sky-600 font-bold text-lg shadow-lg shadow-sky-500/20 transform transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-sky-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-wait hover:bg-sky-700 hover:-translate-y-0.5 active:scale-95"
                            >
                                {loading ? <Spinner /> : 'Masuk'}
                                {loading && <span>Memverifikasi...</span>}
                            </button>
                        </form>
                    </main>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.6s ease-out forwards; }

                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
                
                /* Override browser autofill styles for light theme */
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 30px #ffffff inset !important; /* bg-white */
                    -webkit-text-fill-color: #1e293b !important; /* text-slate-800 */
                    caret-color: #1e293b;
                    transition: background-color 5000s ease-in-out 0s;
                }
            `}</style>
        </>
    );
};

export default LoginPage;