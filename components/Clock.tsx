
import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
  };

  return (
    <div className="text-center my-6">
      <h1 className="text-5xl font-bold text-slate-800">{formatTime(currentTime)}</h1>
      <p className="text-slate-500 mt-2 text-lg">{formatDate(currentTime)}</p>
    </div>
  );
};

export default Clock;
