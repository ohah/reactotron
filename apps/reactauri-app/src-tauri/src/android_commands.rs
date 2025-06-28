use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn get_device_list() -> Result<String, String> {
    let output = std::process::Command::new("adb")
        .arg("devices")
        .output()
        .map_err(|e| format!("Failed to execute adb devices: {}", e))?;
    
    let result = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to parse adb output: {}", e))?;
    
    Ok(result)
}

#[tauri::command]
pub async fn reverse_tunnel_device(device_id: String, reactotron_port: u16, metro_port: u16) -> Result<(), String> {
    // Reverse tunnel for reactotron
    let reactotron_result = std::process::Command::new("adb")
        .args(["-s", &device_id, "reverse", &format!("tcp:{}", reactotron_port), &format!("tcp:{}", reactotron_port)])
        .output()
        .map_err(|e| format!("Failed to reverse tunnel reactotron port: {}", e))?;
    
    if !reactotron_result.status.success() {
        return Err(format!("Reactotron reverse tunnel failed: {}", String::from_utf8_lossy(&reactotron_result.stderr)));
    }
    
    // Reverse tunnel for metro
    let metro_result = std::process::Command::new("adb")
        .args(["-s", &device_id, "reverse", &format!("tcp:{}", metro_port), &format!("tcp:{}", metro_port)])
        .output()
        .map_err(|e| format!("Failed to reverse tunnel metro port: {}", e))?;
    
    if !metro_result.status.success() {
        return Err(format!("Metro reverse tunnel failed: {}", String::from_utf8_lossy(&metro_result.stderr)));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn reload_app(device_id: String) -> Result<(), String> {
    let result = std::process::Command::new("adb")
        .args(["-s", &device_id, "shell", "input", "text", "\"RR\""])
        .output()
        .map_err(|e| format!("Failed to reload app: {}", e))?;
    
    if !result.status.success() {
        return Err(format!("Reload app failed: {}", String::from_utf8_lossy(&result.stderr)));
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
        return Err(format!("Shake device failed: {}", String::from_utf8_lossy(&result.stderr)));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn start_device_tracking(app_handle: AppHandle) -> Result<(), String> {
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
                    println!("Got adb track-devices output: {}", line);
                    // Emit event to frontend
                    let _ = app_handle_clone.emit("device-list-updated", ());
                }
            }
        }
        
        if let Some(stderr) = child.stderr.take() {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            
            for line in reader.lines() {
                if let Ok(line) = line {
                    println!("adb track-devices stderr: {}", line);
                }
            }
        }
        
        let status = child.wait().expect("Failed to wait for adb process");
        if !status.success() {
            println!("adb track-devices process exited with status: {}", status);
        }
    });
    
    Ok(())
} 