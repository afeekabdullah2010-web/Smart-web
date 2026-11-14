const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('smartPowerDesktop',{
 getState:()=>ipcRenderer.invoke('desktop:state'),
 command:value=>ipcRenderer.invoke('desktop:command',value),
 surface:rect=>ipcRenderer.invoke('desktop:surface',rect),
 onState:listener=>{const receive=(_event,value)=>listener(value);ipcRenderer.on('desktop:changed',receive);return()=>ipcRenderer.removeListener('desktop:changed',receive)},
});
