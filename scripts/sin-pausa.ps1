# Evita que la ventana negra se congele al hacer clic dentro de ella.
# En Windows, el "modo de edición rápida" pausa el programa mientras hay una selección
# (el título dice "Seleccionar"). Esto lo desactiva solo para esta ventana.
try {
  Add-Type -Namespace DistintoSCZ -Name Consola -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
'@
  $handle = [DistintoSCZ.Consola]::GetStdHandle(-10)
  $mode = 0
  if ([DistintoSCZ.Consola]::GetConsoleMode($handle, [ref]$mode)) {
    $ENABLE_QUICK_EDIT_MODE = 0x40
    $ENABLE_EXTENDED_FLAGS = 0x80
    [void][DistintoSCZ.Consola]::SetConsoleMode($handle, ($mode -band (-bnot $ENABLE_QUICK_EDIT_MODE)) -bor $ENABLE_EXTENDED_FLAGS)
  }
} catch { }
