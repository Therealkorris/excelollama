import { useState, useEffect, useCallback } from 'react';

type Status = 'running' | 'stopped' | 'starting' | 'error';

interface ProcessManagerProps {
  onStatusChange: (status: Status) => void;
}

export const ProcessManager: React.FC<ProcessManagerProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<Status>('stopped');
  const [error, setError] = useState<string | null>(null);

  const checkBackendStatus = useCallback(async () => {
    setStatus('starting');
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        setStatus('running');
        setError(null);
      } else {
        setStatus('error');
        setError(`Backend responded with status: ${response.status}`);
      }
    } catch (err) {
      setStatus('error');
      setError('Failed to connect to the backend');
    }
  }, []);

  useEffect(() => {
    checkBackendStatus();
    const intervalId = setInterval(checkBackendStatus, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [checkBackendStatus]);

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  const statusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-gray-500';
      case 'starting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`h-3 w-3 rounded-full ${statusColor()}`}></div>
      <span className="text-sm text-gray-700">
        {status === 'running' && 'Backend is running'}
        {status === 'stopped' && 'Backend is stopped'}
        {status === 'starting' && 'Backend is starting...'}
        {status === 'error' && `Backend error: ${error || 'Unknown error'}`}
      </span>
    </div>
  );
};