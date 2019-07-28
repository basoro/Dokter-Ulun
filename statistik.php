<?php include_once ('layout/header.php'); ?>

        <?php
            if(isset($_GET['tahun'])) { $tahun = $_GET['tahun']; } else { $tahun = date("Y"); };
              if(isset($_GET['bulan'])) { $bulan = $_GET['bulan']; } else { $bulan = date("m"); };
        ?>

  <section class="content">
      <div class="container-fluid">
          <div class="block-header">
              <h2>STATISTIK DOKTER <?php echo "Periode ".$bulan." - ".$tahun; ?></h2>
          </div>
                    <!-- CPU Usage -->
          <div class="row clearfix">
              <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12">
                  <div class="card">
                      <div class="header">
                          <div class="row clearfix">
                              <div class="col-xs-12 col-sm-6">
                                  <h2>10 PENYAKIT TERBANYAK</h2>
                              </div>
                          </div>
                      </div>
                      <div class="body">
                      <?php
          $jumlah=array();
          $penyakit=array();
          $kd_penyakit=array();
          $date = $tahun."-".$bulan;
                      $sql = "SELECT c.nm_penyakit, a.kd_penyakit, count(a.kd_penyakit) AS jumlah, d.nm_poli
              FROM diagnosa_pasien a, reg_periksa b, penyakit c, poliklinik d
              WHERE b.tgl_registrasi LIKE '%$date%'
              AND a.no_rawat = b.no_rawat
              AND a.kd_penyakit = c.kd_penyakit
              AND b.kd_poli = '{$_SESSION['jenis_poli']}'
              AND b.kd_poli = d.kd_poli
              AND a.status = 'Ralan'
              GROUP BY a.kd_penyakit
              ORDER BY jumlah DESC
              LIMIT 10";
          $hasil=query($sql);
          while ($data = fetch_array ($hasil)){
                          $jumlah[]=intval($data['jumlah']);
                          $penyakit[]=$data['nm_penyakit'];
                          $kd_penyakit[]=$data['kd_penyakit'];
                      }
          ?>
                              <div id="10penyakit">
                              </div>
                      </div>
                  </div>
              </div>
          </div>
          <!-- #END# CPU Usage -->

          <div class="row clearfix">
              <!-- Line Chart -->
              <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                  <div class="card">
                      <div class="header">
                          <h2>STATUS PENYAKIT</h2>
                          <ul class="header-dropdown m-r--5">
                              <li class="dropdown">
                                  <a href="javascript:void(0);" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
                                      <i class="material-icons">more_vert</i>
                                  </a>
                                  <ul class="dropdown-menu pull-right">
                                      <li><a href="javascript:void(0);">Action</a></li>
                                      <li><a href="javascript:void(0);">Another action</a></li>
                                      <li><a href="javascript:void(0);">Something else here</a></li>
                                  </ul>
                              </li>
                          </ul>
                      </div>
                      <div class="body">
                          <div id="line_chart" class="graph"></div>
                      </div>
                  </div>
              </div>
              <!-- #END# Line Chart -->
              <!-- Donut Chart -->
              <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                  <div class="card">
                      <div class="header">
                          <h2>STATUS RAWAT</h2>
                          <ul class="header-dropdown m-r--5">
                              <li class="dropdown">
                                  <a href="javascript:void(0);" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
                                      <i class="material-icons">more_vert</i>
                                  </a>
                                  <ul class="dropdown-menu pull-right">
                                      <li><a href="javascript:void(0);">Action</a></li>
                                      <li><a href="javascript:void(0);">Another action</a></li>
                                      <li><a href="javascript:void(0);">Something else here</a></li>
                                  </ul>
                              </li>
                          </ul>
                      </div>
                      <div class="body">
                          <div id="donut_chart" class="graph"></div>
                      </div>
                  </div>
              </div>
              <!-- #END# Donut Chart -->
          </div>
    <div class="row clearfix">
              <!-- Line Chart -->
                          <form method="get" action="">
                    <div class="col-lg-4">
                            <select name="bulan" class="form-control">
                              <option value="01">Januari</option>
                              <option value="02">Pebruari</option>
                              <option value="03">Maret</option>
                              <option value="04">April</option>
                              <option value="05">Mei</option>
                              <option value="06">Juni</option>
                              <option value="07">Juli</option>
                              <option value="08">Agustus</option>
                              <option value="09">September</option>
                              <option value="10">Oktober</option>
                              <option value="11">November</option>
                              <option value="12">Desember</option>
                            </select>
                            </div>
                            <div class="col-lg-4">
                            <select name="tahun" class="form-control">
                              <option value="2016">2016</option>
                              <option value="2017">2017</option>
                              <option value="2018">2018</option>
                              <option value="2019" selected>2019</option>
                            </select>
                      </div>
                          <div class="col-lg-4">
                            <input type="submit" class="btn bg-blue btn-block btn-lg waves-effect" value="Submit">
                          </div>
                          </form>
        </div>
        <div class="row clearfix">
          <br><br>
        </div>


      </div>
  </section>

<?php include_once ('layout/footer.php'); ?>
  <!-- Morris Plugin Js -->
  <script src="plugins/raphael/raphael.min.js"></script>
  <script src="plugins/morrisjs/morris.js"></script>

<script type="text/javascript">
      Highcharts.chart('10penyakit', {
      chart: {
        type: 'column'
    },
          exporting: {
              enabled: false
          },
      title: {
        text: 'Grafik Penyakit <?php echo ucwords(strtolower($nmpoli)); ?>'
    },
    subtitle: {
      text: <?=json_encode($dates);?>
    },
      xAxis: {
          categories: <?=json_encode($penyakit);?> ,

      title: {
          enabled: false
      }
    },
    yAxis: {
      title: {
        text: 'Jumlah Pasien'
      },
      labels: {
        formatter: function () {
          return this.value;
        }
      }
    },
    tooltip: {
      split: true,
      valueSuffix: ''
    },
    plotOptions: {
      area: {
      stacking: 'normal',
      lineColor: '#666666',
      lineWidth: 1,
          marker: {
          lineWidth: 1,
          lineColor: '#666666'
        }
      }
    },
    series: [{
      name: 'Jumlah Kejadian',
      data: <?=json_encode($jumlah);?>
    }]
  });
</script>

<?php
$date = $tahun."-".$bulan;
$_tgl_registrasi = "SELECT tgl_registrasi AS tanggal FROM reg_periksa WHERE tgl_registrasi LIKE '%$date%' AND kd_poli = '{$_SESSION['jenis_poli']}' GROUP BY tgl_registrasi";
$hasil = query($_tgl_registrasi);
?>

<script type="text/javascript">

$(function () {
  getMorris('line', 'line_chart');
  getMorris('donut', 'donut_chart');
});


function getMorris(type, element) {
  if (type === 'line') {
      Morris.Line({
          element: element,
          data: [
      <?php while($data = fetch_array($hasil)){ ?>
      {
                  tanggal: '<?php echo $data['tanggal']; ?>',
            baru: '<?php echo num_rows(query("SELECT status_poli AS baru FROM reg_periksa WHERE status_poli = 'Baru' AND tgl_registrasi = '{$data['tanggal']}' AND kd_poli = '{$_SESSION['jenis_poli']}'"));?>',
            lama: '<?php echo num_rows(query("SELECT status_poli AS lama FROM reg_periksa WHERE status_poli = 'Lama' AND tgl_registrasi = '{$data['tanggal']}' AND kd_poli = '{$_SESSION['jenis_poli']}'"));?>'
      },
      <?php } ?>
          ],
          xkey: 'tanggal',
          ykeys: ['baru', 'lama'],
          labels: ['Baru', 'Lama'],
          lineColors: ['rgb(233, 30, 99)', 'rgb(0, 188, 212)'],
          lineWidth: 3
      });
  } else if (type === 'donut') {
      Morris.Donut({
          element: element,
          data: [{
              label: 'Sudah',
              value: <?php echo num_rows(query("SELECT no_rawat FROM reg_periksa WHERE tgl_registrasi LIKE '%$date%' AND kd_poli = '{$_SESSION['jenis_poli']}' AND stts = 'Sudah'"));?>
          }, {
                  label: 'Batal',
                  value: <?php echo num_rows(query("SELECT no_rawat FROM reg_periksa WHERE tgl_registrasi LIKE '%$date%' AND kd_poli = '{$_SESSION['jenis_poli']}' AND stts = 'Batal'"));?>
              }, {
                  label: 'Dirawat',
                  value: <?php echo num_rows(query("SELECT no_rawat FROM reg_periksa WHERE tgl_registrasi LIKE '%$date%' AND kd_poli = '{$_SESSION['jenis_poli']}' AND stts = 'Dirawat'"));?>
              }, {
                  label: 'Belum',
                  value: <?php echo num_rows(query("SELECT no_rawat FROM reg_periksa WHERE tgl_registrasi LIKE '%$date%' AND kd_poli = '{$_SESSION['jenis_poli']}' AND stts = 'Dirawat'"));?>
              }],
          colors: ['rgb(233, 30, 99)', 'rgb(0, 188, 212)', 'rgb(255, 152, 0)', 'rgb(0, 150, 136)'],
          formatter: function (y) {
              return y
          }
      });
  }
}
</script>
