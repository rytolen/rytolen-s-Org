import React from 'react';

interface StatusDisplayProps {
  hasClockedInToday: boolean;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ hasClockedInToday }) => {
  const config = {
    true: {
      text: 'Status: Sudah Absen Hari Ini',
      bg: 'bg-green-100',
      text_color: 'text-green-800',
      dot_color: 'bg-green-500',
    },
    false: {
      text: 'Status: Belum Absen',
      bg: 'bg-slate-200',
      text_color: 'text-slate-800',
      dot_color: 'bg-slate-500',
    },
  };

  const currentConfig = hasClockedInToday ? config.true : config.false;

  return (
    <div className="flex justify-center items-center my-4">
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-md font-semibold ${currentConfig.bg} ${currentConfig.text_color}`}>
        <span className={`w-3 h-3 rounded-full ${currentConfig.dot_color}`}></span>
        {currentConfig.text}
      </div>
    </div>
  );
};

export default StatusDisplay;