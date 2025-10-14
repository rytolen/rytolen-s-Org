import React, { useState } from 'react';

interface LoginPageProps {
    onLogin: (employeeId: string) => Promise<{ success: boolean, message: string }>;
}

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
            setError(result.message || "Login gagal. Periksa kembali ID Anda atau status keaktifan Anda.");
        }
        // On success, the parent component will handle the navigation
    };
    
    return (
        <div className="min-h-screen bg-sky-600 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center text-white mb-10">
                    <h1 className="text-4xl font-bold">Selamat Datang</h1>
                    <p className="text-sky-200 mt-2">Masuk untuk melanjutkan ke portal karyawan.</p>
                </div>
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="employeeId" className="block text-sm font-bold text-slate-700 mb-2">
                                ID Karyawan
                            </label>
                            <input
                                type="text"
                                id="employeeId"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="Contoh: ID52358"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                                disabled={loading}
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-white bg-sky-600 font-bold text-lg shadow-lg transform transition-all duration-150 ease-in-out focus:outline-none focus:ring-4 focus:ring-sky-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-wait hover:bg-sky-700 active:scale-95"
                        >
                            {loading ? 'Memverifikasi...' : 'Masuk'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;