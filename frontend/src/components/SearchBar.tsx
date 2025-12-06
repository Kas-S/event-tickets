import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Search } = Input;

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = 'Search events by title or description...', 
  loading = false 
}) => {
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (value: string) => {
    onSearch(value.trim());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  return (
    <Search
      placeholder={placeholder}
      allowClear
      enterButton="Search"
      size="large"
      value={searchValue}
      onChange={handleChange}
      onSearch={handleSearch}
      loading={loading}
      prefix={<SearchOutlined style={{ color: '#bfbfbf' }} aria-hidden="true" />}
      style={{ width: '100%' }}
      aria-label="Search for events"
      role="search"
    />
  );
};

export default SearchBar;
