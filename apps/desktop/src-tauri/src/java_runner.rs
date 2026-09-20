use std::{
    collections::HashSet,
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use uuid::Uuid;
use wait_timeout::ChildExt;

pub const MAX_SOURCE_BYTES: usize = 64 * 1024;
pub const MAX_TIMEOUT_MS: u64 = 5_000;
pub const MAX_OUTPUT_BYTES: usize = 256 * 1024;
pub const MIN_JDK_MAJOR_VERSION: u32 = 11;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaEnvironment {
    pub version: String,
    pub major_version: u32,
}

#[derive(Clone)]
struct ResolvedJshell {
    executable: PathBuf,
    environment: JavaEnvironment,
}

pub fn validate_request(
    source: &str,
    timeout_ms: u64,
    max_output_bytes: usize,
) -> Result<(), &'static str> {
    if source.trim().is_empty() || source.len() > MAX_SOURCE_BYTES {
        return Err("source");
    }
    if source.lines().any(|line| {
        let line = line.trim_start();
        line.starts_with('/') && !line.starts_with("//") && !line.starts_with("/*")
    }) {
        return Err("source");
    }
    if timeout_ms == 0 || timeout_ms > MAX_TIMEOUT_MS {
        return Err("timeoutMs");
    }
    if max_output_bytes == 0 || max_output_bytes > MAX_OUTPUT_BYTES {
        return Err("maxOutputBytes");
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaExecutionResult {
    pub status: &'static str,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
    pub truncated: bool,
}

pub struct JavaRunnerService {
    active_plugins: Mutex<HashSet<String>>,
    jshell: OnceLock<Result<ResolvedJshell, String>>,
}

impl Default for JavaRunnerService {
    fn default() -> Self {
        Self {
            active_plugins: Mutex::new(HashSet::new()),
            jshell: OnceLock::new(),
        }
    }
}

pub struct JavaRunPermit {
    service: Arc<JavaRunnerService>,
    plugin_id: String,
}

impl Drop for JavaRunPermit {
    fn drop(&mut self) {
        if let Ok(mut active) = self.service.active_plugins.lock() {
            active.remove(&self.plugin_id);
        }
    }
}

impl JavaRunnerService {
    pub fn environment(&self) -> Result<JavaEnvironment, String> {
        Ok(self.jshell.get_or_init(resolve_jshell).clone()?.environment)
    }

    pub fn acquire(self: &Arc<Self>, plugin_id: &str) -> Result<JavaRunPermit, String> {
        let mut active = self
            .active_plugins
            .lock()
            .map_err(|_| "Java 运行状态不可用".to_owned())?;
        if !active.insert(plugin_id.to_owned()) {
            return Err("该插件已有 Java 代码正在运行".to_owned());
        }
        Ok(JavaRunPermit {
            service: Arc::clone(self),
            plugin_id: plugin_id.to_owned(),
        })
    }

    pub fn execute(
        &self,
        source: &str,
        timeout_ms: u64,
        max_output_bytes: usize,
    ) -> Result<JavaExecutionResult, String> {
        let executable = self.jshell.get_or_init(resolve_jshell).clone()?.executable;
        let working_directory = env::temp_dir().join(format!("devbox-java-{}", Uuid::new_v4()));
        fs::create_dir(&working_directory).map_err(|error| error.to_string())?;
        let result = run_jshell(
            &executable,
            &working_directory,
            source,
            timeout_ms,
            max_output_bytes,
        );
        let _ = fs::remove_dir_all(&working_directory);
        result
    }
}

fn discover_jshell() -> PathBuf {
    if let Some(java_home) = env::var_os("JAVA_HOME") {
        let executable = PathBuf::from(java_home).join("bin").join(if cfg!(windows) {
            "jshell.exe"
        } else {
            "jshell"
        });
        if executable.is_file() {
            return executable;
        }
    }
    PathBuf::from(if cfg!(windows) {
        "jshell.exe"
    } else {
        "jshell"
    })
}

fn resolve_jshell() -> Result<ResolvedJshell, String> {
    let executable = discover_jshell();
    let output = Command::new(&executable)
        .arg("--version")
        .output()
        .map_err(|_| "未找到可用的 JShell，请安装 JDK 11 或更高版本".to_owned())?;
    let version_output = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let Some(environment) = parse_jshell_version(&version_output) else {
        return Err("无法识别 JShell 版本，请安装 JDK 11 或更高版本".to_owned());
    };
    if !output.status.success() || environment.major_version < MIN_JDK_MAJOR_VERSION {
        return Err("JShell 版本过低，请安装 JDK 11 或更高版本".to_owned());
    }
    Ok(ResolvedJshell {
        executable,
        environment,
    })
}

fn parse_jshell_version(output: &str) -> Option<JavaEnvironment> {
    output.split_whitespace().find_map(|token| {
        let version = token.trim_start_matches("jshell").trim_start_matches('-');
        if !version.starts_with(|character: char| character.is_ascii_digit()) {
            return None;
        }
        Some(JavaEnvironment {
            version: version.to_owned(),
            major_version: version.split('.').next()?.parse().ok()?,
        })
    })
}

fn run_jshell(
    executable: &Path,
    working_directory: &Path,
    source: &str,
    timeout_ms: u64,
    max_output_bytes: usize,
) -> Result<JavaExecutionResult, String> {
    let started = Instant::now();
    let script_path = working_directory.join("snippet.jsh");
    fs::write(&script_path, format!("{source}\n/exit\n"))
        .map_err(|error| format!("无法创建 Java 代码片段：{error}"))?;
    let user_home = format!("-J-Duser.home={}", working_directory.display());
    let temp_directory = format!("-J-Djava.io.tmpdir={}", working_directory.display());
    let mut child = Command::new(executable)
        .args([
            "--no-startup",
            "--feedback",
            "silent",
            "--execution",
            "local",
            "-J-Xms16m",
            "-J-Xmx128m",
            "-J-XX:MaxMetaspaceSize=96m",
            "-J-Duser.language=en",
            "-J-Duser.country=US",
            &user_home,
            &temp_directory,
        ])
        .arg(&script_path)
        .current_dir(working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "未找到可用的 JShell，请安装 JDK 11 或更高版本".to_owned())?;

    let stdout_thread = drain_output(
        child
            .stdout
            .take()
            .ok_or_else(|| "无法读取 JShell 标准输出".to_owned())?,
        max_output_bytes,
    );
    let stderr_thread = drain_output(
        child
            .stderr
            .take()
            .ok_or_else(|| "无法读取 JShell 错误输出".to_owned())?,
        max_output_bytes,
    );
    let timeout = Duration::from_millis(timeout_ms);
    let (exit_status, timed_out) = match child
        .wait_timeout(timeout)
        .map_err(|error| error.to_string())?
    {
        Some(status) => (Some(status), false),
        None => {
            let _ = child.kill();
            let status = child.wait().ok();
            (status, true)
        }
    };
    let (mut stdout, stdout_truncated) = stdout_thread
        .join()
        .map_err(|_| "读取 JShell 标准输出失败".to_owned())?;
    let (mut stderr, stderr_truncated) = stderr_thread
        .join()
        .map_err(|_| "读取 JShell 错误输出失败".to_owned())?;
    let combined_truncated =
        apply_combined_output_limit(&mut stdout, &mut stderr, max_output_bytes);
    let stdout = String::from_utf8_lossy(&stdout).into_owned();
    let stderr = String::from_utf8_lossy(&stderr).into_owned();
    let execution_failed = !exit_status.as_ref().is_some_and(|status| status.success())
        || contains_jshell_error(&stdout)
        || contains_jshell_error(&stderr);

    Ok(JavaExecutionResult {
        status: if timed_out {
            "timeout"
        } else if execution_failed {
            "error"
        } else {
            "success"
        },
        stdout,
        stderr,
        exit_code: exit_status.and_then(|status| status.code()),
        duration_ms: started.elapsed().as_millis(),
        truncated: stdout_truncated || stderr_truncated || combined_truncated,
    })
}

fn apply_combined_output_limit(stdout: &mut Vec<u8>, stderr: &mut Vec<u8>, maximum: usize) -> bool {
    if stdout.len().saturating_add(stderr.len()) <= maximum {
        return false;
    }
    stdout.truncate(maximum);
    stderr.truncate(maximum.saturating_sub(stdout.len()));
    true
}

fn contains_jshell_error(output: &str) -> bool {
    output.lines().any(|line| {
        let line = line.trim_start_matches('|').trim_start();
        line == "Error:"
            || line.starts_with("Exception ")
            || line.starts_with("Exception in thread ")
    })
}

fn drain_output<R: Read + Send + 'static>(
    mut reader: R,
    maximum: usize,
) -> thread::JoinHandle<(Vec<u8>, bool)> {
    thread::spawn(move || {
        let mut result = Vec::with_capacity(maximum.min(8 * 1024));
        let mut buffer = [0_u8; 8 * 1024];
        let mut truncated = false;
        loop {
            let read = match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => read,
            };
            let remaining = maximum.saturating_sub(result.len());
            let retained = remaining.min(read);
            result.extend_from_slice(&buffer[..retained]);
            if retained < read {
                truncated = true;
            }
        }
        (result, truncated)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 同一插件同时只能运行一个片段() {
        let service = Arc::new(JavaRunnerService::default());
        let permit = service.acquire("devbox.java").expect("第一次应获得许可");
        assert!(service.acquire("devbox.java").is_err());
        assert!(service.acquire("devbox.other").is_ok());
        drop(permit);
        assert!(service.acquire("devbox.java").is_ok());
    }

    #[test]
    fn 输出收集会持续排空并按上限截断() {
        let content = vec![b'a'; 16 * 1024];
        let (output, truncated) = drain_output(std::io::Cursor::new(content), 1024)
            .join()
            .expect("输出线程应结束");
        assert_eq!(output.len(), 1024);
        assert!(truncated);
    }

    #[test]
    fn 标准输出和错误输出共享总量上限() {
        let mut stdout = vec![b'a'; 700];
        let mut stderr = vec![b'b'; 700];
        assert!(apply_combined_output_limit(&mut stdout, &mut stderr, 1_024));
        assert_eq!(stdout.len() + stderr.len(), 1_024);
    }

    #[test]
    fn 请求限制会拒绝越界参数和_jshell_命令() {
        assert_eq!(validate_request("", 1_000, 1_024), Err("source"));
        assert_eq!(
            validate_request("/open other.jsh", 1_000, 1_024),
            Err("source")
        );
        assert_eq!(validate_request("// 普通注释\n1 + 1", 1_000, 1_024), Ok(()));
        assert_eq!(validate_request("1 + 1", 0, 1_024), Err("timeoutMs"));
        assert_eq!(
            validate_request("1 + 1", 1_000, MAX_OUTPUT_BYTES + 1),
            Err("maxOutputBytes")
        );
    }

    #[test]
    fn 解析_jshell_版本并接受_jdk11() {
        let version = parse_jshell_version("jshell 11.0.26").expect("应解析 JDK 11");
        assert_eq!(version.version, "11.0.26");
        assert_eq!(version.major_version, MIN_JDK_MAJOR_VERSION);
        assert_eq!(
            parse_jshell_version("jshell 21.0.8").map(|value| value.major_version),
            Some(21)
        );
        assert!(parse_jshell_version("unknown").is_none());
    }

    #[test]
    fn 可用时通过_jshell_执行代码片段() {
        let Ok(jshell) = resolve_jshell() else {
            return;
        };
        let working_directory =
            env::temp_dir().join(format!("devbox-java-test-{}", Uuid::new_v4()));
        fs::create_dir(&working_directory).expect("应创建测试目录");
        let result = run_jshell(
            &jshell.executable,
            &working_directory,
            "System.out.println(6 * 7);",
            MAX_TIMEOUT_MS,
            16 * 1024,
        )
        .expect("JShell 应成功执行");
        let _ = fs::remove_dir_all(&working_directory);
        assert_eq!(result.status, "success");
        assert_eq!(result.stdout.trim(), "42");
    }

    #[test]
    fn 可用时识别_jshell_语法错误() {
        let Ok(jshell) = resolve_jshell() else {
            return;
        };
        let working_directory =
            env::temp_dir().join(format!("devbox-java-test-{}", Uuid::new_v4()));
        fs::create_dir(&working_directory).expect("应创建测试目录");
        let result = run_jshell(
            &jshell.executable,
            &working_directory,
            "int value = ;",
            MAX_TIMEOUT_MS,
            16 * 1024,
        )
        .expect("JShell 应返回执行结果");
        let _ = fs::remove_dir_all(&working_directory);
        assert_eq!(result.status, "error");
        assert!(result.stdout.contains("Error:") || result.stderr.contains("Error:"));
    }

    #[test]
    fn 可用时识别运行时异常() {
        let Ok(jshell) = resolve_jshell() else {
            return;
        };
        let working_directory =
            env::temp_dir().join(format!("devbox-java-test-{}", Uuid::new_v4()));
        fs::create_dir(&working_directory).expect("应创建测试目录");
        let result = run_jshell(
            &jshell.executable,
            &working_directory,
            "throw new RuntimeException(\"boom\");",
            MAX_TIMEOUT_MS,
            16 * 1024,
        )
        .expect("JShell 应返回执行结果");
        let _ = fs::remove_dir_all(&working_directory);
        assert_eq!(result.status, "error");
        assert!(
            result.stdout.contains("RuntimeException")
                || result.stderr.contains("RuntimeException")
        );
    }

    #[test]
    fn 可用时终止超时代码片段() {
        let Ok(jshell) = resolve_jshell() else {
            return;
        };
        let working_directory =
            env::temp_dir().join(format!("devbox-java-test-{}", Uuid::new_v4()));
        fs::create_dir(&working_directory).expect("应创建测试目录");
        let result = run_jshell(
            &jshell.executable,
            &working_directory,
            "while (true) {}",
            1_000,
            16 * 1024,
        )
        .expect("JShell 应返回超时结果");
        let _ = fs::remove_dir_all(&working_directory);
        assert_eq!(result.status, "timeout");
    }
}
