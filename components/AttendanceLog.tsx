import React from 'react';
import { AttendanceRecord } from '../types';

interface AttendanceLogProps {
  records: AttendanceRecord[];
  title: string;
  showEmptyState?: boolean;
  limitDays?: number;
}

const AttendanceLog: React.FC<AttendanceLogProps> = ({ records, title, showEmptyState = false, limitDays }) => {
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
          return "Hari Ini";
      }
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
  }

  // Sort all records descending first to ensure we process them chronologically.
  const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const groupedRecords: { [key: string]: AttendanceRecord[] } = sortedRecords.reduce((acc, record) => {
    const date = new Date(record.timestamp).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as { [key: string]: AttendanceRecord[] });

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const datesToDisplay = limitDays ? sortedDates.slice(0, limitDays) : sortedDates;

  if (records.length === 0 && showEmptyState) {
    return (
      <div className="text-center py-12 bg-slate-100 rounded-lg m-4">
        <p className="text-slate-500">Belum ada riwayat absensi.</p>
      </div>
    );
  }
  
  return (
    <div className="px-4 py-2">
      {title && <h2 className="text-xl font-bold text-slate-700 mb-4">{title}</h2>}
      <div className="space-y-6">
        {datesToDisplay.map(dateStr => (
          <div key={dateStr}>
            <h3 className="font-semibold text-slate-500 mb-2">{formatDate(groupedRecords[dateStr][0].timestamp)}</h3>
            <ul className="space-y-3">
              {groupedRecords[dateStr].map((record) => (
                <li key={record.id} className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
                  <div className='w-12 h-12 rounded-full flex items-center justify-center bg-green-100 text-green-600'>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Absen Masuk</p>
                    <p className="text-sm text-slate-500">{formatTime(record.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceLog;