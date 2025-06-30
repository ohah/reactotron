import { useEffect } from "react";
import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";

export function useAppMenu() {
  useEffect(() => {
    async function setupMenu() {
      try {
        const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
            await MenuItem.new({
              id: 'quit',
              text: 'Quit',
              accelerator: 'CmdOrCtrl+Q',
              action: () => {
                console.log('Quit pressed');
              },
            }),
          ],
        });

        const viewSubmenu = await Submenu.new({
          text: 'View',
          items: [
            await MenuItem.new({
              id: 'reload',
              text: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              action: () => window.location.reload()
            }),
            await MenuItem.new({
              id: 'force_reload',
              text: 'Force Reload',
              accelerator: 'CmdOrCtrl+Shift+R',
              action: () => window.location.reload()
            }),
            await MenuItem.new({
              id: 'zoom_in',
              text: 'Zoom In',
              accelerator: 'CmdOrCtrl+Plus',
              action: () => {
                document.body.style.zoom = (parseFloat(document.body.style.zoom || "1") + 0.1).toString();
              }
            }),
            await MenuItem.new({
              id: 'zoom_out',
              text: 'Zoom Out',
              accelerator: 'CmdOrCtrl+Minus',
              action: () => {
                document.body.style.zoom = Math.max(0.1, parseFloat(document.body.style.zoom || "1") - 0.1).toString();
              }
            }),
            await MenuItem.new({
              id: 'zoom_reset',
              text: 'Actual Size',
              accelerator: 'CmdOrCtrl+0',
              action: () => {
                document.body.style.zoom = "1";
              }
            }),
          ],
        });

        // Help submenu
        const helpSubmenu = await Submenu.new({
          text: 'Help',
          items: [
            await MenuItem.new({
              id: 'about',
              text: 'About Reactauri',
              action: () => alert("Reactauri v0.1.0\nReact Native Debugging Tool")
            }),
            await MenuItem.new({
              id: 'documentation',
              text: 'Documentation',
              action: () => window.open("https://github.com/infinitered/reactotron", "_blank")
            }),
          ],
        });

        const menu = await Menu.new({
          items: [
            fileSubmenu,
            viewSubmenu,
            helpSubmenu,
          ],
        });

        await menu.setAsAppMenu();
        console.log("Menu setup completed with submenus");
      } catch (error) {
        console.error("Failed to setup menu:", error);
      }
    }

    setupMenu();
  }, []);
} 