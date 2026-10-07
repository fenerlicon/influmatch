// Destek talebi için kullanıcı ve admin ekranında aynı görünen, değişmeyen kısa kod.
// (Eskiden kullanıcının kaçıncı talebi olduğu sayılıyordu: admin listesinde birçok "#1" çıkıyordu
// ve aynı anda açılan iki talep aynı numarayı alabiliyordu.)
export function ticketCode(ticketId: string): string {
  return ticketId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
