import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  Mail, 
  Award, 
  Layers, 
  CreditCard, 
  MessageSquare, 
  Eye,
  ExternalLink
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const { notifications, markNotificationAsRead, markAllNotificationsRead } = useAcademy();
  const [selectedEmailPreview, setSelectedEmailPreview] = useState<NotificationItem['emailPreview'] | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            System & Email Notifications
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markAllNotificationsRead}
            className="text-[11px] text-blue-600 dark:text-cyan-400 hover:underline font-medium"
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const getIcon = () => {
              switch (n.type) {
                case 'certificate': return <Award className="w-4 h-4 text-amber-500" />;
                case 'course': return <Layers className="w-4 h-4 text-blue-500" />;
                case 'billing': return <CreditCard className="w-4 h-4 text-emerald-500" />;
                case 'forum': return <MessageSquare className="w-4 h-4 text-purple-500" />;
                default: return <Bell className="w-4 h-4 text-cyan-500" />;
              }
            };

            return (
              <div
                key={n.id}
                onClick={() => markNotificationAsRead(n.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  n.read
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-slate-900 dark:text-slate-100'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm shrink-0">
                    {getIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs truncate text-slate-900 dark:text-white">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-400">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                      <span className="font-mono">{n.timestamp}</span>

                      {n.emailPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmailPreview(n.emailPreview!);
                          }}
                          className="flex items-center gap-1 text-blue-600 dark:text-cyan-400 hover:underline font-semibold"
                        >
                          <Mail className="w-3 h-3" />
                          <span>View Rendered Email</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rendered Email Template Modal */}
      {selectedEmailPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Outbound SMTP Dispatch</span>
              </div>
              <button onClick={() => setSelectedEmailPreview(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg space-y-0.5">
              <p><strong>To:</strong> {selectedEmailPreview.to}</p>
              <p><strong>Subject:</strong> {selectedEmailPreview.subject}</p>
              <p><strong>Server:</strong> smtp.netplus.academy (TLS 1.3)</p>
            </div>

            <div
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white text-slate-800 text-xs overflow-y-auto max-h-60"
              dangerouslySetInnerHTML={{ __html: selectedEmailPreview.bodyHtml }}
            />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEmailPreview(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
