@echo off
REM Run by a Windows scheduled task (e.g. "LarkAssistant-InternSalary") at 17:00 on
REM the 15th of each month. Sends this month's intern salary summary to Dora
REM (idempotent via salary-sent.json). No HTTP server needed.
cd /d "%~dp0"
call npm run --silent send-salary >> "data\salary-task.log" 2>&1
