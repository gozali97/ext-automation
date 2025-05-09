/**
 * Konfigurasi untuk tombol Digital Panel
 */
export interface ButtonConfig {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  iconPosition?: 'left' | 'right';
  text?: string;
}

/**
 * Membuat tombol Digital Panel
 * @param config Konfigurasi tombol
 * @param clickHandler Handler untuk event click
 * @returns Element tombol yang dibuat
 */
export function createDigitalPanelButton(
  config: ButtonConfig = {},
  clickHandler: (e: MouseEvent) => void
): HTMLElement {
  const {
    className = '',
    style = {},
    iconPosition = 'left',
    text = 'By Digitalpanel'
  } = config;

  // Buat tombol
  const button = document.createElement('a');
  button.className = `digital-panel-btn ${className}`;
  button.href = '#';
  
  // Terapkan style
  Object.keys(style).forEach(key => {
    (button.style as any)[key] = (style as any)[key];
  });

  // Buat ikon download
  const downloadIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-49 141 512 512" width="16" height="16" aria-hidden="true" style="width: 1em; height: 1em; fill: currentColor; margin-right: ${iconPosition === 'left' ? '8px' : '0'}; margin-left: ${iconPosition === 'right' ? '8px' : '0'}; vertical-align: middle;">
      <path d="M438 403c-13.808 0-25 11.193-25 25v134c0 19.299-15.701 35-35 35H36c-19.299 0-35-15.701-35-35V428c0-13.807-11.193-25-25-25s-25 11.193-25 25v134c0 46.869 38.131 85 85 85h342c46.869 0 85-38.131 85-85V428c0-13.807-11.192-25-25-25"></path>
      <path d="M189.322 530.678a25.004 25.004 0 0 0 35.356 0l84.853-84.853c9.763-9.763 9.763-25.592 0-35.355s-25.592-9.763-35.355 0L232 452.645V172c0-13.807-11.193-25-25-25s-25 11.193-25 25v280.645l-42.175-42.175c-9.764-9.763-25.592-9.763-35.355 0s-9.763 25.592 0 35.355z"></path>
    </svg>
  `;

  // Tambahkan konten tombol
  button.innerHTML = iconPosition === 'left'
    ? `${downloadIcon}${text}`
    : `${text}${downloadIcon}`;

  // Tambahkan event listener
  button.addEventListener('click', clickHandler);

  return button;
}

/**
 * Menambahkan animasi klik pada tombol
 * @param event Event mouse
 */
export function addButtonClickAnimation(event: MouseEvent): void {
  const button = (event.target as HTMLElement).closest('.digital-panel-btn');
  if (button) {
    button.classList.add('clicked');
    setTimeout(() => button.classList.remove('clicked'), 300);
  }
}

/**
 * Menambahkan class hidden ke tombol data-cy="credits-pop-button"
 * @param button Tombol yang akan ditambahkan event listener
 */
export function addHiddenClassToCreditsPopButton(): void {
  const creditsPopButton = document.querySelector('[data-cy="credits-pop-button"]');
  const userDiv = document.querySelector('div#user');
  if (userDiv && userDiv instanceof HTMLElement) {
    userDiv.style.display = 'none';
  }
  if (creditsPopButton) {
    creditsPopButton.classList.add('hidden');
  }
}

