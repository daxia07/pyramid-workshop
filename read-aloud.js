// Uses the device's speech support; the same directions always stay on screen.
export function bindReadAloud(notice) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    document.documentElement.classList.add('no-speech');
    return;
  }
  let active;
  const stop = () => {
    window.speechSynthesis.cancel();
    if (active?.isConnected) { active.textContent='♪ Read to me'; active.setAttribute('aria-pressed','false'); }
    active=null;
  };
  document.addEventListener('click',event => {
    const button=event.target.closest('[data-read-aloud]');
    const wasActive=active===button;
    stop();
    if (!button || wasActive) return;
    const text=document.querySelector(button.dataset.readAloud)?.textContent?.trim();
    if (!text) return;
    const speech=new SpeechSynthesisUtterance(text);
    speech.lang='en'; speech.rate=.85;
    active=button;button.textContent='■ Stop reading';button.setAttribute('aria-pressed','true');
    speech.onend=()=>{if(active===button)stop();};
    speech.onerror=event=>{
      if(active!==button)return;
      stop();
      if(!['canceled','interrupted'].includes(event.error))notice('Reading aloud is unavailable right now. Follow the words on screen.');
    };
    window.speechSynthesis.speak(speech);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
}
