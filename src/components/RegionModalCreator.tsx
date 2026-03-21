import React from 'react';
import ModalCreator from 'react-modal';
import '../stylesheets/GlobeModal.css';

interface RegionModalCreatorProps {
  showModal: boolean;
  onCloseRequest: () => void;
  children?: React.ReactNode;
}

const RegionModalCreator: React.FC<RegionModalCreatorProps> = ({
  showModal,
  onCloseRequest,
  children,
}) => {
  return (
    <ModalCreator
      isOpen={showModal}
      onRequestClose={onCloseRequest}
      className="GlobeModal"
      overlayClassName="Overlay"
      ariaHideApp={false}
      closeTimeoutMS={200}
      style={{
        overlay: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#01010ecc',
          zIndex: 100,
        },
      }}
    >
      <div className="CloseButtonPostioning">
        <span
          onClick={onCloseRequest}
          className="CloseButton"
        >
          &times;
        </span>
      </div>
      {children}
    </ModalCreator>
  );
};

export default RegionModalCreator;
