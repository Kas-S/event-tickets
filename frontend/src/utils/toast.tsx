import { message } from 'antd';

message.config({
  top: 80,
  duration: 3,
  maxCount: 3,
});

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
}

const toast = {
  success: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      message.success(options);
    } else {
      const content = options.description 
        ? `${options.title || 'Success'}: ${options.description}`
        : options.title || 'Success';
      message.success({
        content,
        duration: options.duration ?? 4,
        onClose: options.onClose,
      });
    }
  },

  error: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      message.error(options);
    } else {
      const content = options.description 
        ? `${options.title || 'Error'}: ${options.description}`
        : options.title || 'Error';
      message.error({
        content,
        duration: options.duration ?? 5,
        onClose: options.onClose,
      });
    }
  },

  warning: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      message.warning(options);
    } else {
      const content = options.description 
        ? `${options.title || 'Warning'}: ${options.description}`
        : options.title || 'Warning';
      message.warning({
        content,
        duration: options.duration ?? 4,
        onClose: options.onClose,
      });
    }
  },

  info: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      message.info(options);
    } else {
      const content = options.description 
        ? `${options.title || 'Info'}: ${options.description}`
        : options.title || 'Info';
      message.info({
        content,
        duration: options.duration ?? 4,
        onClose: options.onClose,
      });
    }
  },

  loading: (content: string, duration?: number) => {
    return message.loading({
      content,
      duration: duration ?? 0,
    });
  },

  destroy: () => {
    message.destroy();
  },
};

export default toast;
