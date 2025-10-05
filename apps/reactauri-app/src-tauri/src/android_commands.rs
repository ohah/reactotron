use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn get_device_list(app_handle: tauri::AppHandle) -> Result<String, String> {
    let output = std::process::Command::new("adb")
        .arg("devices")
        .output()
        .map_err(|e| format!("Failed to execute adb devices: {}", e))?;
    
    let result = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to parse adb output: {}", e))?;
    
    #[cfg(debug_assertions)]
    println!("get_device_list: {}", result);
    let _ = app_handle.emit("device_list", result.clone());
    
    Ok(result)
}

#[tauri::command]
pub async fn reverse_tunnel_device(device_id: String, reactotron_port: u16, metro_port: u16) -> Result<(), String> {
    // Reverse tunnel for reactotron
    let reactauri_result = std::process::Command::new("adb")
        .args(["-s", &device_id, "reverse", &format!("tcp:{}", reactotron_port), &format!("tcp:{}", reactotron_port)])
        .output()
        .map_err(|e| format!("Failed to reverse tunnel reactotron port: {}", e))?;
    
    if !reactauri_result.status.success() {
        #[cfg(debug_assertions)]
        println!("Reactotron reverse tunnel failed: {:?}", reactauri_result);
        return Err(format!("Reactotron reverse tunnel failed: {}", String::from_utf8_lossy(&reactauri_result.stderr)));
    } else {
        #[cfg(debug_assertions)]
        println!("Reactotron reverse tunnel success: {:?}", reactauri_result);
    }
    
    // Reverse tunnel for metro
    let metro_result = std::process::Command::new("adb")
        .args(["-s", &device_id, "reverse", &format!("tcp:{}", metro_port), &format!("tcp:{}", metro_port)])
        .output()
        .map_err(|e| format!("Failed to reverse tunnel metro port: {}", e))?;
    
    if !metro_result.status.success() {
        #[cfg(debug_assertions)]
        println!("Metro reverse tunnel failed: {:?}", metro_result);
        return Err(format!("Metro reverse tunnel failed: {}", String::from_utf8_lossy(&metro_result.stderr)));
    } else {
        #[cfg(debug_assertions)]
        println!("Metro reverse tunnel success: {:?}", metro_result);
    }
    
    Ok(())
}

#[tauri::command]
pub async fn reload_app(device_id: String) -> Result<(), String> {
    let result = std::process::Command::new("adb")
        .args(["-s", &device_id, "shell", "input", "text", "\"RR\""])
        .output()
        .map_err(|e| format!("Failed to reload app: {}", e))?;
    #[cfg(debug_assertions)]
    println!("reload_app: {:?}", result);
    if !result.status.success() {
        return Err(format!("Reload app failed: {}", String::from_utf8_lossy(&result.stderr)));
    } else {
        #[cfg(debug_assertions)]
        println!("Reload app success: {:?}", result.stdout);
    }
    
    Ok(())
}

#[tauri::command]
pub async fn shake_device(device_id: String) -> Result<(), String> {
    let result = std::process::Command::new("adb")
        .args(["-s", &device_id, "shell", "input", "keyevent", "82"])
        .output()
        .map_err(|e| format!("Failed to shake device: {}", e))?;
    
    if !result.status.success() {
        #[cfg(debug_assertions)]
        println!("Shake device failed: {:?}", result);
        return Err(format!("Shake device failed: {}", String::from_utf8_lossy(&result.stderr)));
    } else {
        #[cfg(debug_assertions)]
        println!("Shake device success: {:?}", result);
    }
    
    Ok(())
}

pub fn start_device_tracking_internal(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    
    let app_handle_clone = app_handle.clone();
    
    std::thread::spawn(move || {
        let mut child = std::process::Command::new("adb")
            .arg("track-devices")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .expect("Failed to start adb track-devices");
        
        if let Some(stdout) = child.stdout.take() {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stdout);
            
            for line in reader.lines() {
                if let Ok(line) = line {
                    #[cfg(debug_assertions)]
                    println!("Got adb track-devices output: {}", line);
                    // TypeScript 버전과 동일하게 디바이스 목록을 가져와서 프론트엔드에 전송
                    if let Ok(output) = std::process::Command::new("adb")
                        .arg("devices")
                        .output() {
                        if let Ok(device_list) = String::from_utf8(output.stdout) {
                            #[cfg(debug_assertions)]
                            println!("Got adb device lis 전송t: {}", device_list);
                            let _ = app_handle_clone.emit("device_list", device_list);
                        }
                    }
                }
            }
        }
        
        if let Some(stderr) = child.stderr.take() {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            
            for line in reader.lines() {
                if let Ok(line) = line {
                    #[cfg(debug_assertions)]
                    println!("adb track-devices stderr: {}", line);
                }
            }
        }
        
        let status = child.wait().expect("Failed to wait for adb process");
        if !status.success() {
            #[cfg(debug_assertions)]
            println!("adb track-devices process exited with status: {}", status);
        }
    });
    
    Ok(())
}
