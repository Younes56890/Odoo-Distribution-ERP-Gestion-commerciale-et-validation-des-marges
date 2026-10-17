import { forwardRef } from 'react';
import {
  ArrowLeft as PhArrowLeft, ArrowRight as PhArrowRight, ArrowUpRight as PhArrowUpRight,
  Barcode as PhBarcode, CalendarBlank, CaretRight, ChartBar, Check as PhCheck, CheckCircle,
  CheckSquare, Clock, Eyeglasses, FilePlus as PhFilePlus, Files as PhFiles, FileText,
  List, MagnifyingGlass, Money, Package, PaperPlaneTilt, PencilSimple, Plus as PhPlus,
  Receipt as PhReceipt, ShieldCheck as PhShieldCheck, ShieldWarning, ShoppingBag as PhShoppingBag,
  SidebarSimple, SignOut, SlidersHorizontal as PhSlidersHorizontal, SpinnerGap, Target as PhTarget,
  Trash, Tray, Truck as PhTruck, Wallet as PhWallet, WarningCircle, X as PhX,
  ArrowSquareOut,
} from '@phosphor-icons/react';

// One icon family and one weight throughout the product; keep page APIs stable.
function icon(Component) {
  const Wrapped = forwardRef(function ProductIcon({ strokeWidth, ...props }, ref) {
    return <Component ref={ref} weight="bold" aria-hidden="true" {...props}/>;
  });
  return Wrapped;
}
export const AlertCircle = icon(WarningCircle);
export const ArrowLeft = icon(PhArrowLeft);
export const ArrowRight = icon(PhArrowRight);
export const ArrowUpRight = icon(PhArrowUpRight);
export const Banknote = icon(Money);
export const Barcode = icon(PhBarcode);
export const BarChart3 = icon(ChartBar);
export const Calendar = icon(CalendarBlank);
export const Check = icon(PhCheck);
export const CheckCircle2 = icon(CheckCircle);
export const CheckCheck = icon(CheckSquare);
export const ChevronRight = icon(CaretRight);
export const Clock3 = icon(Clock);
export const ExternalLink = icon(ArrowSquareOut);
export const FileCheck2 = icon(FileText);
export const FilePlus = icon(PhFilePlus);
export const FilePlus2 = icon(PhFilePlus);
export const Files = icon(PhFiles);
export const Glasses = icon(Eyeglasses);
export const Inbox = icon(Tray);
export const LoaderCircle = icon(SpinnerGap);
export const LogOut = icon(SignOut);
export const Menu = icon(List);
export const PackageCheck = icon(Package);
export const Pencil = icon(PencilSimple);
export const Plus = icon(PhPlus);
export const Receipt = icon(PhReceipt);
export const Search = icon(MagnifyingGlass);
export const Send = icon(PaperPlaneTilt);
export const Settings2 = icon(PhSlidersHorizontal);
export const ShieldAlert = icon(ShieldWarning);
export const ShieldCheck = icon(PhShieldCheck);
export const ShoppingBag = icon(PhShoppingBag);
export const SidebarToggle = icon(SidebarSimple);
export const SlidersHorizontal = icon(PhSlidersHorizontal);
export const Target = icon(PhTarget);
export const Trash2 = icon(Trash);
export const Truck = icon(PhTruck);
export const Wallet = icon(PhWallet);
export const X = icon(PhX);
