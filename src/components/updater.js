// Auto-updater UI component
export function initializeUpdater() {
  if (!window.api?.updater) {
    console.log('Updater API not available (development mode)');
    return;
  }

  let updateInfo = null;
  let downloadProgress = 0;

  // Listen for update events
  window.api.updater.onAvailable((info) => {
    console.log('Update available:', info);
    updateInfo = info;
    showUpdateNotification(info);
  });

  window.api.updater.onNotAvailable((info) => {
    console.log('No updates available:', info);
  });

  window.api.updater.onError((message) => {
    console.error('Update error:', message);
    showUpdateError(message);
  });

  window.api.updater.onDownloadProgress((progress) => {
    downloadProgress = progress.percent;
    updateDownloadProgress(progress);
  });

  window.api.updater.onDownloaded((info) => {
    console.log('Update downloaded:', info);
    showInstallPrompt(info);
  });

  function showUpdateNotification(info) {
    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title"><i class="bi bi-download me-2"></i>Nova posodobitev na voljo!</h5>
          </div>
          <div class="modal-body">
            <p><strong>Verzija ${info.version}</strong> je na voljo za prenos.</p>
            <p class="text-muted">Trenutna verzija: ${info.currentVersion || 'Neznana'}</p>
            ${info.releaseNotes ? `<div class="mt-3"><strong>Spremembe:</strong><div class="mt-2" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap;">${info.releaseNotes}</div></div>` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="update-later">Pozneje</button>
            <button type="button" class="btn btn-primary" id="update-download">Prenesi posodobitev</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#update-later').onclick = () => modal.remove();
    modal.querySelector('#update-download').onclick = async () => {
      modal.remove();
      await downloadUpdate();
    };
  }

  async function downloadUpdate() {
    const modal = document.createElement('div');
    modal.id = 'download-progress-modal';
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-download me-2"></i>Prenašanje posodobitve...</h5>
          </div>
          <div class="modal-body">
            <div class="progress">
              <div id="download-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%">0%</div>
            </div>
            <p class="text-muted mt-2 mb-0" id="download-status">Pripravljanje...</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    try {
      await window.api.updater.download();
    } catch (error) {
      modal.remove();
      showUpdateError(error.message);
    }
  }

  function updateDownloadProgress(progress) {
    const progressBar = document.getElementById('download-progress-bar');
    const status = document.getElementById('download-status');
    if (progressBar && status) {
      const percent = Math.round(progress.percent);
      progressBar.style.width = `${percent}%`;
      progressBar.textContent = `${percent}%`;
      
      const transferred = (progress.transferred / 1024 / 1024).toFixed(1);
      const total = (progress.total / 1024 / 1024).toFixed(1);
      const speed = (progress.bytesPerSecond / 1024 / 1024).toFixed(1);
      status.textContent = `${transferred} MB / ${total} MB (${speed} MB/s)`;
    }
  }

  function showInstallPrompt(info) {
    // Remove download progress modal
    const progressModal = document.getElementById('download-progress-modal');
    if (progressModal) progressModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title"><i class="bi bi-check-circle me-2"></i>Posodobitev prenešena!</h5>
          </div>
          <div class="modal-body">
            <p>Posodobitev je bila uspešno prenešena in je pripravljena za namestitev.</p>
            <p class="text-muted">Aplikacija se bo ponovno zagnala po namestitvi.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="install-later">Namesti ob izhodu</button>
            <button type="button" class="btn btn-success" id="install-now">Namesti zdaj</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#install-later').onclick = () => modal.remove();
    modal.querySelector('#install-now').onclick = async () => {
      await window.api.updater.install();
    };
  }

  function showUpdateError(message) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>Napaka pri posodobitvi:</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // Add manual check button to settings (if available)
  function addManualCheckButton() {
    const settingsContent = document.getElementById('appContent');
    if (settingsContent && window.location.hash === '#/settings') {
      const checkButton = document.createElement('button');
      checkButton.className = 'btn btn-outline-primary btn-sm';
      checkButton.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Preveri posodobitve';
      checkButton.onclick = async () => {
        checkButton.disabled = true;
        checkButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Preverjam...';
        try {
          await window.api.updater.check();
        } catch (error) {
          showUpdateError(error.message);
        } finally {
          checkButton.disabled = false;
          checkButton.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Preveri posodobitve';
        }
      };
      // You can add this button to settings page if needed
    }
  }
}
