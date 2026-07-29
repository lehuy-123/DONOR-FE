const { execSync } = require('child_process');

try {
  console.log("Running git config credential helper setup to ensure push works...");
  // Just in case Windows credential manager prompts
  
  console.log("Running git add .");
  execSync('git add .', { cwd: 'c:/Users/Tinh Tam/Videos/DONOR3/DONOR/frontend', stdio: 'inherit' });
  
  console.log("Running git commit");
  execSync('git commit -m "Update layout, remove conflict markers, fix API_BASE"', { cwd: 'c:/Users/Tinh Tam/Videos/DONOR3/DONOR/frontend', stdio: 'inherit' });
  
  console.log("Running git push origin main");
  execSync('git push origin main', { cwd: 'c:/Users/Tinh Tam/Videos/DONOR3/DONOR/frontend', stdio: 'inherit' });
  
  console.log("Successfully pushed!");
} catch (e) {
  console.error("Git error occurred:", e.message);
  if (e.stdout) console.error("STDOUT:", e.stdout.toString());
  if (e.stderr) console.error("STDERR:", e.stderr.toString());
}
