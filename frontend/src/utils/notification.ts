import { message } from 'antd';

message.config({
  top: 80,
  duration: 3,
  maxCount: 3,
});

interface NotificationOptions {
  duration?: number;
  onClose?: () => void;
}

export const notification = {
  success: (content: string, options?: NotificationOptions) => {
    return message.success({
      content,
      duration: options?.duration ?? 3,
      onClose: options?.onClose,
    });
  },

  error: (content: string, options?: NotificationOptions) => {
    return message.error({
      content,
      duration: options?.duration ?? 4,
      onClose: options?.onClose,
    });
  },

  warning: (content: string, options?: NotificationOptions) => {
    return message.warning({
      content,
      duration: options?.duration ?? 3,
      onClose: options?.onClose,
    });
  },

  info: (content: string, options?: NotificationOptions) => {
    return message.info({
      content,
      duration: options?.duration ?? 3,
      onClose: options?.onClose,
    });
  },

  loading: (content: string, options?: NotificationOptions) => {
    return message.loading({
      content,
      duration: options?.duration ?? 0,
      onClose: options?.onClose,
    });
  },

  destroy: () => {
    message.destroy();
  },
};

export default notification;
