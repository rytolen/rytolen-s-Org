import React, { useState, useEffect, useCallback } from 'react';
import AttendanceLog from '../components/AttendanceLog';
import { AttendanceRecord, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface HistoryPageProps {
  user: UserProfile;
  onBack: () => void;
}

type FilterType = 'this_month' | 'last_month' | 'custom';

const HistoryPage: React.FC<HistoryPageProps> = ({ user, onBack }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('this_month');
  
  const today = new Date();
  const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);
  
  const fetchHistory = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    
    // Adjust end date to include the entire day
    const startOfDay = new Date(start);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(end);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('riwayat_absensi')
      .select('id, timestamp_masuk')
      .eq('karyawan_id', user.employeeId)
      .gte('timestamp_masuk', startOfDay.toISOString())
      .lte('timestamp_masuk', endOfDay.toISOString())
      .order('timestamp_masuk', { ascending: false });

    if (error) {
      console.error("Gagal memuat riwayat:", error);
      setError("Tidak dapat memuat riwayat absensi.");
      setRecords([]);
    } else {
      setRecords(data.map(log => ({ id: log.id, timestamp: log.timestamp_masuk })));
    }
    setLoading(false);
  }, [user.employeeId]);

  // Initial data fetch
  useEffect(() => {
    fetchHistory(startDate, endDate);
  }, [startDate, endDate, fetchHistory]);
  
  // Real-time listener for new attendance records
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel(`history-page-listener-for-${user.employeeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'riwayat_absensi', filter: `karyawan_id=eq.${user.employeeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
              const newRecord: AttendanceRecord = { id: payload.new.id, timestamp: payload.new.timestamp_masuk };
              const newRecordDate = new Date(newRecord.timestamp);
              
              const start = new Date(startDate);
              start.setUTCHours(0,0,0,0);
              const end = new Date(endDate);
              end.setUTCHours(23,59,59,999);
              
              // Check if the new record is within the current filter range
              if (newRecordDate >= start && newRecordDate <= end) {
                setRecords(prevRecords => 
                  [newRecord, ...prevRecords]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                );
              }
          } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id as string;
              if (deletedId) {
                setRecords(prevRecords => prevRecords.filter(record => record.id !== deletedId));
              }
          }
        }
      )
      .subscribe();
      
    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.employeeId, startDate, endDate]);

  const handleFilterChange = (type: FilterType) => {
    setFilterType(type);
    const now = new Date();
    let start, end;

    if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
        // For custom, don't change dates immediately, wait for user input
        return;
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };
  
  const FilterButton: React.FC<{label: string, type: FilterType}> = ({ label, type }) => (
    <button 
        onClick={() => handleFilterChange(type)}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${filterType === type ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
    >
        {label}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="p-4 pt-6 sticky top-0 bg-slate-50/80 backdrop-blur-lg z-10 border-b border-slate-200 flex items-center">
          <button onClick={onBack} className="mr-4 text-slate-600 hover:text-slate-900 p-2 rounded-full hover:bg-slate-200 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Absensi</h1>
      </header>
      
      <div className="p-4 space-y-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <FilterButton label="Bulan Ini" type="this_month" />
            <FilterButton label="Bulan Lalu" type="last_month" />
            <FilterButton label="Kustom" type="custom" />
        </div>
        {filterType === 'custom' && (
            <div className="flex items-center gap-4 animate-fade-in">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
                <span className="text-slate-500 font-semibold">to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto pt-4">
        {loading ? (
            <div className="text-center py-12 text-slate-500">Memuat data...</div>
        ) : error ? (
            <div className="text-center py-12 text-red-500">{error}</div>
        ) : records.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Tidak ada riwayat absensi pada rentang tanggal ini.</div>
        ) : (
            <AttendanceLog records={records} title="" showEmptyState={false} />
        )}
      </div>
      <style>{`
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default HistoryPage;