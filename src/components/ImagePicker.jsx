import React from 'react';

export default function ImagePicker({ label, value, onChange, compact }) {
  const handlePick = async () => {
    const filePath = await window.api.pickImage();
    if (filePath) {
      onChange(filePath);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  if (compact) {
    return (
      <div className="image-picker compact" onClick={handlePick}>
        {value ? (
          <div className="image-picker-preview">
            <img src={'file:///' + value.replace(/\\/g, '/')} alt="" />
            <button className="image-picker-clear" onClick={handleClear}>x</button>
          </div>
        ) : (
          <div className="image-picker-empty">
            <span className="image-picker-icon">+</span>
          </div>
        )}
        {label && <span className="image-picker-label">{label}</span>}
      </div>
    );
  }

  return (
    <div className="image-picker" onClick={handlePick}>
      {value ? (
        <div className="image-picker-preview large">
          <img src={'file:///' + value.replace(/\\/g, '/')} alt="" />
          <button className="image-picker-clear" onClick={handleClear}>x</button>
        </div>
      ) : (
        <div className="image-picker-empty large">
          <span className="image-picker-icon">+</span>
          <span>{label || 'Add Image'}</span>
        </div>
      )}
    </div>
  );
}
