import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../domain/quote';

export default function RevenueChart({ data, currency }) {
  return <div className="revenue-chart" role="img" aria-label={`Facturation par mois : ${data.map(item => `${item.name} ${money(item.value, currency)}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barCategoryGap="28%" margin={{ top: 24, right: 20, left: 5, bottom: 12 }}>
      <CartesianGrid vertical={false} stroke="#eeede8"/>
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#73766c', fontSize: 12 }} dy={10}/>
      <YAxis width={48} axisLine={false} tickLine={false} tick={{ fill: '#73766c', fontSize: 11 }} tickFormatter={value => Math.abs(value) >= 1000 ? `${value / 1000}k` : value}/>
      <Tooltip cursor={{ fill: '#f3f3ee' }} formatter={value => [money(value, currency), 'Facturé HT']} contentStyle={{ borderRadius: 8, border: '1px solid #eaeaea', fontFamily: 'Manrope Variable', fontSize: 12 }}/>
      <Bar dataKey="value" fill="#8fa78a" activeBar={{ fill: '#4b6545' }} maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false}/>
    </BarChart></ResponsiveContainer>
  </div>;
}
