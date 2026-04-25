$c = Get-Content 'd:\Antigravity Projects\HR Payroll System\src\app\reports\page.tsx'
$newContent = $c[0..732] + $c[734..($c.Length-1)]
Set-Content 'd:\Antigravity Projects\HR Payroll System\src\app\reports\page.tsx' $newContent
